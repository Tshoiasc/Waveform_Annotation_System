#!/bin/bash

# 数据集状态检查脚本
# 用法: ./scripts/check-dataset.sh [数据集路径]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认配置
ENV_FILE=".env"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 获取数据集路径
get_dataset_path() {
    local dataset_path="$1"

    # 如果没有指定路径，从环境变量获取
    if [ -z "$dataset_path" ] && [ -f "$ENV_FILE" ]; then
        dataset_path=$(grep "^DATASET_PATH=" "$ENV_FILE" 2>/dev/null | cut -d= -f2)
    fi

    # 默认路径
    if [ -z "$dataset_path" ]; then
        dataset_path="./dataset"
    fi

    echo "$dataset_path"
}

# 检查目录结构
check_directory_structure() {
    local dataset_path="$1"

    log_info "检查目录结构..."

    if [ ! -d "$dataset_path" ]; then
        log_error "数据集目录不存在: $dataset_path"
        echo "  建议运行: ./scripts/setup-dataset.sh --init"
        return 1
    fi

    log_success "数据集目录存在: $dataset_path"

    # 检查子目录
    local required_dirs=("raw" "processed" "annotations" "exports")
    local missing_dirs=()

    for dir in "${required_dirs[@]}"; do
        if [ -d "$dataset_path/$dir" ]; then
            log_success "  ✓ $dir/ 目录存在"
        else
            log_warn "  ✗ $dir/ 目录缺失"
            missing_dirs+=("$dir")
        fi
    done

    if [ ${#missing_dirs[@]} -gt 0 ]; then
        echo -e "\n${YELLOW}缺失的目录：${NC}"
        for dir in "${missing_dirs[@]}"; do
            echo "  - $dir/"
        done
        echo -e "\n建议运行: ./scripts/setup-dataset.sh --init $dataset_path"
    fi
}

# 检查权限
check_permissions() {
    local dataset_path="$1"

    log_info "检查权限..."

    if [ ! -r "$dataset_path" ]; then
        log_error "数据集目录不可读: $dataset_path"
        return 1
    fi

    if [ ! -w "$dataset_path" ]; then
        log_warn "数据集目录不可写: $dataset_path"
        echo "  如需写入权限，运行: ./scripts/setup-dataset.sh --fix-permissions"
    else
        log_success "数据集目录可读写"
    fi

    # 检查文件数量和大小
    if [ -d "$dataset_path" ]; then
        local file_count=$(find "$dataset_path" -type f | wc -l)
        local dir_size=$(du -sh "$dataset_path" 2>/dev/null | cut -f1)

        echo "  文件数量: $file_count"
        echo "  目录大小: $dir_size"
    fi
}

# 检查数据文件
check_data_files() {
    local dataset_path="$1"

    log_info "检查数据文件..."

    # 检查原始数据文件
    if [ -d "$dataset_path/raw" ]; then
        local h5_files=$(find "$dataset_path/raw" -name "*.h5" -o -name "*.hdf5" | wc -l)
        if [ "$h5_files" -gt 0 ]; then
            log_success "找到 $h5_files 个 HDF5 数据文件"
        else
            log_warn "raw/ 目录中没有找到 HDF5 文件"
            echo "  支持的格式: .h5, .hdf5"
        fi
    fi

    # 检查标注文件
    if [ -d "$dataset_path/annotations" ]; then
        local annotation_files=$(find "$dataset_path/annotations" -name "*.json" | wc -l)
        if [ "$annotation_files" -gt 0 ]; then
            log_success "找到 $annotation_files 个标注文件"
        else
            log_info "暂无标注文件（正常情况）"
        fi
    fi
}

# 检查环境配置
check_environment() {
    log_info "检查环境配置..."

    if [ -f "$ENV_FILE" ]; then
        log_success "环境配置文件存在: $ENV_FILE"

        # 检查关键配置
        local dataset_path_env=$(grep "^DATASET_PATH=" "$ENV_FILE" 2>/dev/null | cut -d= -f2)
        local write_enabled=$(grep "^ENABLE_DATASET_WRITE=" "$ENV_FILE" 2>/dev/null | cut -d= -f2)

        if [ -n "$dataset_path_env" ]; then
            echo "  配置的数据集路径: $dataset_path_env"
        fi

        if [ "$write_enabled" = "true" ]; then
            log_success "  数据集写入权限: 已启用"
        elif [ "$write_enabled" = "false" ]; then
            log_warn "  数据集写入权限: 已禁用"
        fi
    else
        log_warn "环境配置文件不存在: $ENV_FILE"
        echo "  建议运行: cp .env.example .env"
    fi
}

# 检查容器状态
check_container_status() {
    log_info "检查容器状态..."

    if ! command -v docker &> /dev/null; then
        log_warn "Docker 未安装"
        return 1
    fi

    if ! docker ps &> /dev/null; then
        log_warn "Docker 未运行或无权限"
        return 1
    fi

    # 检查相关容器
    local containers=("waveform-backend" "waveform-frontend" "waveform-mongodb")
    local running_containers=0

    for container in "${containers[@]}"; do
        if docker ps --format "table {{.Names}}" | grep -q "$container"; then
            log_success "  ✓ $container 运行中"
            ((running_containers++))
        else
            log_warn "  ✗ $container 未运行"
        fi
    done

    if [ $running_containers -eq 0 ]; then
        echo -e "\n${YELLOW}启动服务：${NC}"
        echo "  docker-compose up -d"
    elif [ $running_containers -lt 3 ]; then
        echo -e "\n${YELLOW}重启所有服务：${NC}"
        echo "  docker-compose restart"
    fi
}

# 生成报告
generate_report() {
    local dataset_path="$1"

    echo -e "\n${BLUE}=== 数据集状态报告 ===${NC}"
    echo "数据集路径: $dataset_path"
    echo "检查时间: $(date)"
    echo ""

    # 运行所有检查
    check_directory_structure "$dataset_path"
    echo ""

    check_permissions "$dataset_path"
    echo ""

    check_data_files "$dataset_path"
    echo ""

    check_environment
    echo ""

    check_container_status
    echo ""

    echo -e "${BLUE}=== 检查完成 ===${NC}"
}

# 主函数
main() {
    local dataset_path=$(get_dataset_path "$1")

    echo -e "${BLUE}数据集状态检查工具${NC}"
    echo "版本: 1.0.0"
    echo ""

    generate_report "$dataset_path"
}

# 执行主函数
main "$@"