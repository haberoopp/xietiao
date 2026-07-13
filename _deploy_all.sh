#!/bin/bash
# Deploy all remaining cloud functions to Nodejs18.15
ENV_ID="cloudbase-d6g98vaoyb7ec331a"
FUNCTIONS=(
  updateOrder cancelOrder requestReturn addressCRUD customerCRUD
  adminLogin adminLogout adminGetOrders adminGetReturns
  adminUpdateOrderPrice adminHandleReturn adminAddProduct
  adminUpdateProduct adminDeleteProduct adminOrderImage
  adminDeleteOrderImage adminTogglePickedUp importProducts
  subscribeAdmin initAdminAccounts
)

for fn in "${FUNCTIONS[@]}"; do
  echo "=== Deploying $fn ==="
  echo "y" | tcb fn deploy "$fn" --env-id "$ENV_ID" --force 2>&1 | tail -1
done

echo "=== All done ==="
echo "=== Verifying runtimes ==="
tcb fn list --env-id "$ENV_ID" 2>&1 | grep -E "Nodejs16|Nodejs18"
