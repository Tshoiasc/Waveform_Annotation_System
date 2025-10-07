#!/bin/bash

# 数据集初始化和切换脚本
# 用法: ./scripts/setup-dataset.sh [数据集路径] [选项]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 默认配置
DEFAULT_DATASET_PATH="./dataset"
ENV_FILE=".env"
ENV_EXAMPLE=".env.example"

# 显示帮助信息
show_help() {
    echo "数据集管理脚本"
    echo ""
    echo "用法:"
    echo "  $0 [数据集路径] [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help          显示帮助信息"
    echo "  -i, --init          初始化新的数据集目录"
    echo "  -s, --switch        切换到指定数据集"
    echo "  -b, --backup        备份当前数据集"
    echo "  -r, --restore       从备份恢复数据集"
    echo "  --read-only         设置为只读模式"
    echo "  --read-write        设置为读写模式（默认）"
    echo "  --fix-permissions   修复数据集权限"
    echo ""
    echo "示例:"
    echo "  $0 ./dataset --init              # 初始化默认数据集"
    echo "  $0 /path/to/dataset --switch     # 切换数据集"
    echo "  $0 --backup                      # 备份当前数据集"
    echo "  $0 --fix-permissions             # 修复权限问题"
}

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Docker 是否运行
check_docker() {
    if ! docker ps &> /dev/null; then
        log_error "Docker 未运行或无权限访问"
        exit 1
    fi
}

# 初始化环境变量文件
init_env_file() {
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "$ENV_EXAMPLE" ]; then
            cp "$ENV_EXAMPLE" "$ENV_FILE"
            log_info "创建 $ENV_FILE 文件"
        else
            log_warn "$ENV_EXAMPLE 文件不存在，创建基本配置"
            cat > "$ENV_FILE" << EOF
# 数据集配置
DATASET_PATH=$1
ENABLE_DATASET_WRITE=true
EOF
        fi
    fi
}

# 更新环境变量
update_env_var() {
    local var_name=$1
    local var_value=$2

    if grep -q "^${var_name}=" "$ENV_FILE"; then
        # 更新现有变量
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^${var_name}=.*|${var_name}=${var_value}|" "$ENV_FILE"
        else
            sed -i "s|^${var_name}=.*|${var_name}=${var_value}|" "$ENV_FILE"
        fi
    else
        # 添加新变量
        echo "${var_name}=${var_value}" >> "$ENV_FILE"
    fi
    log_info "更新 ${var_name}=${var_value}"
}

# 初始化数据集目录
init_dataset() {
    local dataset_path=$1

    log_info "初始化数据集目录: $dataset_path"

    # 创建目录结构
    mkdir -p "$dataset_path"
    mkdir -p "$dataset_path/raw"
    mkdir -p "$dataset_path/processed"
    mkdir -p "$dataset_path/annotations"
    mkdir -p "$dataset_path/exports"

    # 创建README文件
    cat > "$dataset_path/README.md" << EOF
# 数据集目录结构

## 目录说明

- \`raw/\` - 原始数据文件（HDF5格式）
- \`processed/\` - 处理后的数据
- \`annotations/\` - 标注数据
- \`exports/\` - 导出的结果

## 使用说明

1. 将原始数据文件放入 \`raw/\` 目录
2. 系统会自动处理数据并生成标注
3. 完成的标注保存在 \`annotations/\` 目录
4. 导出结果保存在 \`exports/\` 目录

## 注意事项

- 支持的格式: .h5, .hdf5
- 确保文件权限正确设置
- 建议定期备份重要数据
EOF

    # 创建示例配置文件
    cat > "$dataset_path/dataset.json" << EOF
{
  "name": "$(basename "$dataset_path")",
  "version": "1.0.0",
  "created": "$(date -Iseconds)",
  "description": "波形数据集",
  "formats": ["h5", "hdf5"],
  "structure": {
    "raw": "原始数据文件",
    "processed": "处理后的数据",
    "annotations": "标注数据",
    "exports": "导出结果"
  }
}
EOF

    log_info "数据集目录结构创建完成"
}

# 切换数据集
switch_dataset() {
    local dataset_path=$1

    if [ ! -d "$dataset_path" ]; then
        log_error "数据集目录不存在: $dataset_path"
        read -p "是否创建新目录? [y/N]: " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            init_dataset "$dataset_path"
        else
            exit 1
        fi
    fi

    log_info "切换到数据集: $dataset_path"
    update_env_var "DATASET_PATH" "$dataset_path"

    # 重启服务以应用更改
    if docker-compose ps | grep -q "waveform-backend"; then
        log_info "重启后端服务以应用数据集更改..."
        docker-compose restart backend
    fi
}

# 备份数据集
backup_dataset() {
    local dataset_path=${1:-$(grep "^DATASET_PATH=" "$ENV_FILE" | cut -d= -f2)}
    local backup_dir="backups"
    local backup_name="dataset-backup-$(date +%Y%m%d-%H%M%S)"

    mkdir -p "$backup_dir"

    if [ -d "$dataset_path" ]; then
        log_info "备份数据集: $dataset_path -> $backup_dir/$backup_name"
        tar -czf "$backup_dir/$backup_name.tar.gz" -C "$(dirname "$dataset_path")" "$(basename "$dataset_path")"
        log_info "备份完成: $backup_dir/$backup_name.tar.gz"
    else
        log_error "数据集目录不存在: $dataset_path"
        exit 1
    fi
}

# 修复权限
fix_permissions() {
    local dataset_path=${1:-$(grep "^DATASET_PATH=" "$ENV_FILE" | cut -d= -f2)}

    if [ -d "$dataset_path" ]; then
        log_info "修复数据集权限: $dataset_path"

        # 修复目录权限
        find "$dataset_path" -type d -exec chmod 755 {} \;

        # 修复文件权限
        find "$dataset_path" -type f -exec chmod 644 {} \;

        # 如果是在容器中运行，确保容器用户可以访问
        if command -v docker &> /dev/null; then
            # 获取当前用户ID
            local user_id=$(id -u)
            local group_id=$(id -g)

            # 如果用户ID不是0（非root），则调整权限
            if [ "$user_id" != "0" ]; then
                log_info "调整权限以支持容器访问（用户ID: $user_id）"
                chmod -R u+w "$dataset_path"
            fi
        fi

        log_info "权限修复完成"
    else
        log_error "数据集目录不存在: $dataset_path"
        exit 1
    fi
}

# 设置读写模式
set_write_mode() {
    local mode=$1
    update_env_var "ENABLE_DATASET_WRITE" "$mode"

    if [ "$mode" = "true" ]; then
        log_info "数据集设置为读写模式"
    else
        log_info "数据集设置为只读模式"
    fi
}

# 主逻辑
main() {
    local dataset_path=""
    local action=""

    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -i|--init)
                action="init"
                shift
                ;;
            -s|--switch)
                action="switch"
                shift
                ;;
            -b|--backup)
                action="backup"
                shift
                ;;
            --fix-permissions)
                action="fix_permissions"
                shift
                ;;
            --read-only)
                action="read_only"
                shift
                ;;
            --read-write)
                action="read_write"
                shift
                ;;
            -*)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
            *)
                dataset_path="$1"
                shift
                ;;
        esac
    done

    # 如果没有指定路径，使用默认路径
    if [ -z "$dataset_path" ] && [ "$action" = "init" -o "$action" = "switch" ]; then
        dataset_path="$DEFAULT_DATASET_PATH"
    fi

    # 检查Docker状态（某些操作需要）
    if [ "$action" = "switch" ]; then
        check_docker
    fi

    # 初始化环境变量文件
    if [ "$action" != "backup" ]; then
        init_env_file "$dataset_path"
    fi

    # 执行相应操作
    case $action in
        init)
            init_dataset "$dataset_path"
            update_env_var "DATASET_PATH" "$dataset_path"
            ;;
        switch)
            switch_dataset "$dataset_path"
            ;;
        backup)
            backup_dataset "$dataset_path"
            ;;
        fix_permissions)
            fix_permissions "$dataset_path"
            ;;
        read_only)
            set_write_mode "false"
            ;;
        read_write)
            set_write_mode "true"
            ;;
        *)
            if [ -n "$dataset_path" ]; then
                switch_dataset "$dataset_path"
            else
                show_help
            fi
            ;;
    esac
}

# 执行主函数
main "$@"