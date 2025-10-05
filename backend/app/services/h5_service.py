import os
import h5py
import numpy as np
from scipy import signal
from typing import Dict, List, Optional, Tuple
from pathlib import Path
from app.config import settings

class H5Service:
    """H5文件处理服务"""

    def __init__(self):
        self.data_root = Path(settings.H5_DATA_PATH)
        self.default_sample_rate = 1000.0
        self.reconstruct_buffer = 0.1
        self.lowpass_cutoff = 30.0
        self.lowpass_order = 4

    def scan_files(self) -> List[Dict]:
        """扫描dataset目录下所有H5文件"""
        h5_files = []

        if not self.data_root.exists():
            print(f"⚠️  Dataset directory not found: {self.data_root}")
            return h5_files

        for root, dirs, files in os.walk(self.data_root):
            for file in files:
                if file.endswith('.h5'):
                    full_path = Path(root) / file
                    rel_path = full_path.relative_to(self.data_root)

                    h5_files.append({
                        "fileId": str(rel_path),
                        "fullPath": str(full_path),
                        "fileName": file,
                        "size": full_path.stat().st_size
                    })

        return h5_files

    def load_trial_count(self, file_path: str) -> int:
        """获取H5文件中Trial数量"""
        try:
            with h5py.File(file_path, 'r') as f:
                # 查找所有trial_X格式的group
                trial_keys = [key for key in f.keys() if key.startswith('trial_')]
                return len(trial_keys)
        except Exception as e:
            print(f"❌ Error loading trial count from {file_path}: {e}")
            return 0

    def get_trial_keys(self, file_path: str) -> List[str]:
        """获取H5文件中所有Trial键名列表（已排序）"""
        try:
            with h5py.File(file_path, 'r') as f:
                trial_keys = [key for key in f.keys() if key.startswith('trial_')]
                # 按trial编号排序
                trial_keys.sort(key=lambda x: int(x.split('_')[1]))
                return trial_keys
        except Exception as e:
            print(f"❌ Error getting trial keys from {file_path}: {e}")
            return []

    def load_trial_metadata(self, file_path: str, trial_index: int) -> Dict:
        """加载Trial元数据和缩略图，复用与主图一致的预处理流程"""
        try:
            processed = self._prepare_waveform(file_path, trial_index)

            timestamps = processed["timestamps"]
            filtered = processed["filtered_values"]
            raw_values = processed["raw_values"]

            thumbnail = self._generate_thumbnail(
                timestamps,
                filtered,
                target_points=200
            )

            return {
                "trialIndex": trial_index,
                "duration": processed["duration"],
                "sampleRate": float(processed["sample_rate"]),
                "dataPoints": int(len(raw_values)),
                "thumbnail": {
                    "timestamps": thumbnail['timestamps'].tolist(),
                    "values": thumbnail['values'].tolist()
                }
            }

        except Exception as e:
            print(f"❌ Error loading metadata for trial {trial_index}: {e}")
            raise

    def preprocess_waveform(self, file_path: str, trial_index: int) -> Dict:
        """完整波形预处理"""
        try:
            processed = self._prepare_waveform(file_path, trial_index)

            timestamps = processed["timestamps"].tolist()
            raw_values = processed["raw_values"].tolist()
            filtered_values = processed["filtered_values"].tolist()
            keypoints = processed["keypoints"].tolist()

            return {
                "raw": {
                    "timestamps": timestamps,
                    "values": raw_values
                },
                "filtered": {
                    "timestamps": timestamps,
                    "values": filtered_values
                },
                "keypoints": keypoints
            }

        except Exception as e:
            print(f"❌ Error preprocessing waveform: {e}")
            raise

    def _read_trial_data(
        self,
        file_path: str,
        trial_index: int
    ) -> Tuple[np.ndarray, np.ndarray]:
        trial_keys = self.get_trial_keys(file_path)

        if trial_index >= len(trial_keys):
            raise ValueError(f"Trial index {trial_index} out of range (max: {len(trial_keys) - 1})")

        trial_key = trial_keys[trial_index]

        with h5py.File(file_path, 'r') as f:
            trial_group = f[trial_key]

            if 'sensor' in trial_group:
                raw_data = trial_group['sensor'][:]
            elif 'data' in trial_group:
                raw_data = trial_group['data'][:]
            else:
                raise ValueError(f"No 'sensor' or 'data' dataset found in {trial_key}")

            if 'timestamps' in trial_group:
                timestamps = trial_group['timestamps'][:]
            else:
                timestamps = np.arange(len(raw_data)) / 1000.0

        return raw_data, timestamps

    def _infer_timestamp_scale(
        self,
        timestamps: Optional[np.ndarray]
    ) -> float:
        """推断时间戳的单位缩放系数（将原始单位换算为秒）"""
        if timestamps is None or len(timestamps) <= 1:
            return 1.0

        ts = np.asarray(timestamps, dtype=float)
        diffs = np.diff(ts)
        positive_diffs = diffs[diffs > 0]

        if positive_diffs.size == 0:
            return 1.0

        median_delta = float(np.median(positive_diffs))
        expected_chunk_duration = self.reconstruct_buffer

        if expected_chunk_duration <= 0 or median_delta <= 0:
            return 1.0

        scale = median_delta / expected_chunk_duration

        if not np.isfinite(scale) or scale <= 0:
            return 1.0

        return float(scale)

    def _estimate_sample_rate(
        self,
        timestamps: Optional[np.ndarray],
        length: int,
        scale: float
    ) -> Optional[float]:
        if timestamps is None or len(timestamps) <= 1:
            return None

        ts = np.asarray(timestamps, dtype=float)
        total_units = float(ts[-1] - ts[0])

        scale = scale if scale and scale > 0 else 1.0
        total_seconds = total_units / scale

        if total_seconds <= 0:
            return None

        sample_rate = float(length / total_seconds)
        return sample_rate if np.isfinite(sample_rate) else None

    def _normalize_sample_rate(self, sample_rate: Optional[float]) -> float:
        """兜底采样率，避免异常值导致滤波失效"""
        if sample_rate is None or not np.isfinite(sample_rate):
            return float(self.default_sample_rate)

        if sample_rate < self.default_sample_rate * 0.2:
            return float(self.default_sample_rate)

        return float(sample_rate)

    def _prepare_waveform(
        self,
        file_path: str,
        trial_index: int
    ) -> Dict[str, object]:
        raw_data, source_timestamps = self._read_trial_data(file_path, trial_index)

        timestamp_scale = self._infer_timestamp_scale(source_timestamps)
        sample_rate = self._estimate_sample_rate(
            source_timestamps,
            len(raw_data),
            timestamp_scale
        )
        safe_sample_rate = self._normalize_sample_rate(sample_rate)

        reconstructed_timestamps = self._reconstruct_timestamps(
            raw_data,
            source_timestamps,
            timestamp_scale,
            fs=safe_sample_rate
        )

        filtered_data = self._lowpass_filter(
            raw_data,
            cutoff=self.lowpass_cutoff,
            fs=safe_sample_rate,
            order=self.lowpass_order
        )

        keypoints = self._extract_keypoints(filtered_data, min_distance=3)

        duration = (
            float(reconstructed_timestamps[-1] - reconstructed_timestamps[0])
            if len(reconstructed_timestamps) > 1 else 0.0
        )

        return {
            "sample_rate": safe_sample_rate,
            "duration": duration,
            "raw_values": raw_data,
            "timestamps": reconstructed_timestamps,
            "filtered_values": filtered_data,
            "keypoints": keypoints,
        }

    def _lowpass_filter(
        self,
        data: np.ndarray,
        cutoff: float,
        fs: float,
        order: int
    ) -> np.ndarray:
        """巴特沃斯低通滤波器"""
        nyquist = 0.5 * fs
        if nyquist <= 0:
            return data

        normal_cutoff = cutoff / nyquist

        # 如果截止频率超过奈奎斯特频率，自动下调
        if normal_cutoff >= 1:
            normal_cutoff = min(normal_cutoff, 0.99)

        if normal_cutoff <= 0:
            return data

        b, a = signal.butter(order, normal_cutoff, btype='low', analog=False)
        return signal.filtfilt(b, a, data)

    def _reconstruct_timestamps(
        self,
        data: np.ndarray,
        raw_timestamps: Optional[np.ndarray],
        scale: float,
        fs: float
    ) -> np.ndarray:
        """重建时间轴，优先复用原始时间戳信息"""
        n_samples = len(data)

        if raw_timestamps is not None and len(raw_timestamps) == n_samples:
            ts = np.asarray(raw_timestamps, dtype=float)
            diffs = np.diff(ts)
            positive_mask = diffs > 0

            if np.any(positive_mask):
                boundary_indices = np.where(positive_mask)[0] + 1
                key_indices = np.concatenate(([0], boundary_indices, [n_samples - 1]))
                key_indices = np.unique(key_indices)

                if key_indices.size >= 2:
                    key_units = ts[key_indices]
                    key_units = key_units - key_units[0]

                    scale = scale if scale and scale > 0 else 1.0
                    key_seconds = key_units / scale

                    if np.any(np.diff(key_indices) > 0) and key_seconds[-1] >= 0:
                        full_indices = np.arange(n_samples)
                        reconstructed = np.interp(full_indices, key_indices, key_seconds)
                        return reconstructed

        fs = fs if fs and fs > 0 else self.default_sample_rate
        return np.arange(n_samples) / fs

    def _extract_keypoints(
        self,
        data: np.ndarray,
        min_distance: int = 3
    ) -> np.ndarray:
        """提取拐点 (斜率突变点)"""
        if len(data) < 2:
            return np.array([])

        dy = np.diff(data)

        # MAD自适应阈值
        mad = np.median(np.abs(dy - np.median(dy)))
        threshold = np.percentile(np.abs(dy), 75) + 1.5 * mad

        # 检测突变点
        keypoints = np.where(np.abs(dy) >= threshold)[0]

        # 最小距离去重
        if len(keypoints) > 0:
            filtered = [keypoints[0]]
            for kp in keypoints[1:]:
                if kp - filtered[-1] >= min_distance:
                    filtered.append(kp)
            return np.array(filtered)

        return np.array([])

    def _generate_thumbnail(
        self,
        timestamps: np.ndarray,
        values: np.ndarray,
        target_points: int = 100
    ) -> Dict:
        """生成缩略图 (降采样)"""
        if len(values) <= target_points:
            return {
                "timestamps": timestamps,
                "values": values
            }

        bucket_size = max(1, len(values) // target_points)
        selected_indices: List[int] = []

        for start in range(0, len(values), bucket_size):
            end = min(start + bucket_size, len(values))
            segment = values[start:end]
            if segment.size == 0:
                continue

            local_min_idx = int(np.argmin(segment)) + start
            local_max_idx = int(np.argmax(segment)) + start

            if local_min_idx <= local_max_idx:
                selected_indices.append(local_min_idx)
                if local_max_idx != local_min_idx:
                    selected_indices.append(local_max_idx)
            else:
                selected_indices.append(local_max_idx)
                selected_indices.append(local_min_idx)

        # 去重并保持顺序
        seen = set()
        ordered_indices = []
        for idx in selected_indices:
            if idx not in seen:
                ordered_indices.append(idx)
                seen.add(idx)

        ordered_indices = np.array(ordered_indices, dtype=int)
        ordered_indices = np.clip(ordered_indices, 0, len(values) - 1)

        return {
            "timestamps": timestamps[ordered_indices],
            "values": values[ordered_indices]
        }


# 创建全局实例
h5_service = H5Service()
