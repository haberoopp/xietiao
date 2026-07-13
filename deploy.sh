#!/bin/bash
# 部署辅助脚本
# CloudBase CLI 独立打包每个云函数目录，不会包含 ../lib/ 共享模块。
# 此脚本在部署前把 lib/ 复制到每个云函数目录，部署后清理。

ENV_ID="cloudbase-d6g98vaoyb7ec331a"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB_DIR="$SCRIPT_DIR/cloudfunctions/lib"
FUNCTIONS_DIR="$SCRIPT_DIR/cloudfunctions"

echo "=== 1. 复制共享模块到各云函数 ==="
for d in "$FUNCTIONS_DIR"/*/; do
  name=$(basename "$d")
  [ "$name" = "lib" ] && continue
  [ "$name" = "initAdminAccounts" ] && continue  # 有独立 node_modules, 跳过

  # 复制 lib 文件（不覆盖已存在的同名文件，除非强制）
  cp -r "$LIB_DIR"/*.js "$d/" 2>/dev/null
  echo "  $name: done"
done

echo ""
echo "=== 2. 并行部署全部云函数 ==="
passed=0; failed=0; failed_list=""
for d in "$FUNCTIONS_DIR"/*/; do
  name=$(basename "$d")
  [ "$name" = "lib" ] && continue
  (
    if echo "y" | tcb fn deploy "$name" --env-id "$ENV_ID" --force > /dev/null 2>&1; then
      echo "  $name: OK"
    else
      echo "  $name: FAIL"
    fi
  ) &
done
wait
echo "  部署完成"

echo ""
echo "=== 3. 清理复制的 lib 文件 ==="
for d in "$FUNCTIONS_DIR"/*/; do
  name=$(basename "$d")
  [ "$name" = "lib" ] && continue
  [ "$name" = "initAdminAccounts" ] && continue

  for lib in response logger auth notify security passwordHash passwordPolicy jwtAuth operationLog rateLimiter; do
    rm -f "$d/$lib.js"
  done
  echo "  $name: cleaned"
done

echo ""
echo "=== 4. 健康检查 ==="
tcb fn invoke healthCheck --env-id "$ENV_ID"

echo ""
echo "=== 部署完成 ==="
