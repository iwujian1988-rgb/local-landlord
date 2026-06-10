# API Contract — 本地房东小程序

> 本文档是前后端数据契约的"真相来源"。
> 后端必须按此返回，前端必须按此读取。
> 任何字段变更必须先更新本文档。

---

## 1. GET /stats/home

首页统计。返回首页所需的所有数据。

```json
{
  "greeting": "早上好",
  "profileName": "张阿姨",
  "todoCount": 2,
  "pendingHouseholds": 2,
  "pendingDesc": "李姐已逾期，王先生今天该收",
  "monthlyCollected": 14500,
  "showRoomGuide": false,
  "showTenantGuide": true,
  "showQrGuide": true
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| greeting | string | 时段问候语 |
| profileName | string | 房东姓名 |
| todoCount | number | 待处理数（今天该收 + 已逾期） |
| pendingHouseholds | number | 待处理户数 |
| pendingDesc | string | 一句话描述待处理情况 |
| monthlyCollected | number | 本月已收金额（分） |
| showRoomGuide | boolean | 是否显示"还没有房间"引导 |
| showTenantGuide | boolean | 是否显示"房间空着呢"引导 |
| showQrGuide | boolean | 是否显示"设置收款码"引导 |

---

## 2. GET /rent/pending

收租待办列表。返回分组列表。

```json
{
  "today": [PendingEntry],
  "approaching": [PendingEntry],
  "overdue": [PendingEntry],
  "completed": [PendingEntry]
}
```

### 分组规则

| 分组 | 条件 |
|------|------|
| today | 今天 = 收租日，当期账单未付 |
| approaching | 收租日 - 今天 ∈ [1, 3]，当期账单未付 |
| overdue | 今天 > 收租日，当期账单未付；或有往期未付账单 |
| completed | 当期账单已付 |

### PendingEntry

```json
{
  "roomId": 1,
  "roomName": "101 房",
  "propertyName": "幸福里小区",
  "propertyId": 1,
  "rent": 3500,
  "tenantName": "王先生",
  "tenantId": 1,
  "contractEndDate": "2026-08-10",
  "rentDay": 10,
  "billId": 5,
  "billStatus": 0,
  "totalAmount": 3790,
  "overdueDays": 0,
  "daysUntil": 0,
  "hasOverdue": false
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| roomId | number | 房间 ID |
| roomName | string | 房间名 |
| propertyName | string | 所属房源名 |
| propertyId | number | 房源 ID |
| rent | number | 月租金 |
| tenantName | string | 租客姓名，空房为 "" |
| tenantId | number \| null | 租客 ID |
| contractEndDate | string | 合同到期日 |
| rentDay | number | 每月几号收租（0=月底） |
| billId | number \| null | 当期账单 ID |
| billStatus | number | 账单状态 0=未付 1=已付 |
| totalAmount | number | 账单总金额 |
| overdueDays | number | 逾期天数（0=未逾期） |
| daysUntil | number | 距收租日还有几天 |
| hasOverdue | boolean | 是否有往期欠费 |

---

## 3. GET /rooms

全局房间列表。返回当前房东所有房间（跨房源）。

```json
[
  {
    "id": 1,
    "name": "101 房",
    "rent": 3500,
    "status": 1,
    "images": ["url1"],
    "propertyId": 1,
    "propertyName": "幸福里小区",
    "tenantName": "王先生",
    "tenantId": 1,
    "rentDay": 10,
    "displayStatus": "rented",
    "overdueDays": 0,
    "feeItems": [
      { "id": 1, "name": "房租", "type": "fixed", "amount": 3500, "enabled": true, "isRent": true }
    ]
  }
]
```

### displayStatus 字符串映射

| 值 | 说明 |
|----|------|
| "vacant" | 空着 |
| "rented" | 已租（正常） |
| "overdue" | 欠租 |
| "approaching" | 快到收租日 |

### feeItems.type 字符串映射

| 数据库值 | API 返回 |
|---------|---------|
| 0 | "fixed" |
| 1 | "manual" |

---

## 4. GET /rooms/:roomId/bills

账单列表。返回当期账单 + 房间信息 + 费用明细。

```json
{
  "roomName": "101 房",
  "tenantName": "王先生",
  "billItems": [
    { "name": "房租", "amount": 3500, "type": "fixed", "feeId": 1 },
    { "name": "水费", "amount": 0, "type": "manual", "feeId": 2 }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| roomName | string | 房间名 |
| tenantName | string | 租客姓名 |
| billItems | BillItem[] | 费用明细列表 |

### BillItem

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 费用名 |
| amount | number | 金额 |
| type | string | "fixed" 或 "manual" |
| feeId | number \| null | 对应的 FeeItem ID |

---

## 5. POST /rooms/:roomId/bills

创建/更新账单。

请求体：
```json
{
  "period": "2026-06",
  "items": [
    { "feeName": "房租", "amount": 3500 },
    { "feeName": "水费", "amount": 80 }
  ],
  "photos": ["url1"],
  "tenantId": 1,
  "totalAmount": 3790
}
```

---

## 6. PUT /bills/:id/confirm

确认收款。标记账单为已付 + 创建收租记录。

请求体（可选）：
```json
{
  "paymentNote": "微信转账",
  "actualAmount": 3790
}
```

返回：更新后的 Bill 实体。

---

## 7. GET /rooms/:roomId

房间详情。

```json
{
  "id": 1,
  "name": "101 房",
  "rent": 3500,
  "status": 1,
  "deposit": 3500,
  "area": "25平米",
  "floor": "3楼",
  "orientation": "朝南",
  "facilities": ["有空调", "有独卫"],
  "images": ["url1"],
  "note": "",
  "availableDate": null,
  "propertyId": 1,
  "property": { "id": 1, "name": "幸福里小区" },
  "tenant": {
    "id": 1, "name": "王先生", "phone": "13800000000",
    "rentDay": 10, "contractEndDate": "2026-08-10",
    "moveInDate": "2024-08-10", "deposit": 3500, "note": ""
  },
  "feeItems": [
    { "id": 1, "name": "房租", "type": "fixed", "amount": 3500, "enabled": true, "isRent": true }
  ],
  "latestBill": { "id": 5, "period": "2026-06", "totalAmount": 3790, "status": 0 },
  "displayStatus": "rented"
}
```

**关键：`tenant` 字段（不是 `activeTenant`），`feeItems[].type` 返回字符串。**

---

## 8. GET /properties/:propertyId/rooms

房源下房间列表。

```json
{
  "list": [
    {
      "id": 1, "name": "101 房", "rent": 3500, "status": 1,
      "images": ["url1"], "displayStatus": "rented",
      "tenantName": "王先生", "rentDay": 10,
      "overdueDays": 0, "contractEndDate": "2026-08-10",
      "totalAmount": 3790
    }
  ],
  "summary": { "total": 4, "vacant": 1, "rented": 3, "overdue": 1 },
  "propertyName": "幸福里小区"
}
```

**关键：返回中包含 `propertyName`、每间房的 `tenantName`、`overdueDays`。**

---

## 9. GET /stats/rent

收租统计。

```json
{
  "period": "2026-06",
  "monthLabel": "2026 年 6 月",
  "totalExpected": 18000,
  "totalCollected": 14500,
  "totalPending": 3500,
  "totalRate": 80.6,
  "properties": [
    {
      "name": "幸福里小区",
      "rooms": 4,
      "received": 3,
      "overdue": 1,
      "expected": 14470,
      "collected": 10970,
      "pending": 3500,
      "rate": 75.8
    }
  ],
  "periodComparison": {
    "current": 14500,
    "lastMonth": 17850,
    "quarter": 48260,
    "year": 216800
  }
}
```

---

## 10. GET /payment-qr

收款码列表。

```json
{
  "codes": [
    {
      "id": 1,
      "type": "wechat",
      "imageUrl": "url",
      "isDefault": true,
      "payeeName": "张阿姨",
      "note": ""
    }
  ],
  "payeeName": "张阿姨",
  "payeeNote": "付款后请微信告诉我"
}
```

### PaymentQr.type 字符串映射

| 数据库值 | API 返回 |
|---------|---------|
| 0 | "wechat" |
| 1 | "alipay" |
| 2 | "bank" |

---

## 11. GET /rooms/:roomId/documents

文档列表。

```json
[
  {
    "id": 1,
    "type": "contract",
    "name": "租房合同",
    "imageUrl": "url",
    "note": "",
    "date": "2024-08-10"
  }
]
```

### Document.type 字符串映射

| 数据库值 | API 返回 |
|---------|---------|
| 0 | "contract" |
| 1 | "receipt" |
| 2 | "utility" |
| 3 | "repair" |
| 4 | "deposit" |
| 5 | "other" |

---

## 12. GET /rooms/:roomId/records

收租记录。

```json
[
  {
    "id": 1,
    "type": "bill_sent",
    "title": "5月账单已发送",
    "description": "金额：3,790 元 · 状态：待支付",
    "amount": 3790,
    "time": "2026-05-01 10:00",
    "dotColor": "accent"
  }
]
```

### RentRecord.type 字符串映射

| 数据库值 | API 返回 | dotColor |
|---------|---------|----------|
| 0 | "bill_sent" | "accent" |
| 1 | "bill_paid" | "green" |
| 2 | "single_charge" | "orange" |
| 3 | "single_paid" | "green" |
| 4 | "reminder" | "accent" |

---

## 13. POST /rooms/:roomId/fee-items (批量)

批量保存费用项。

请求体：
```json
{
  "fees": [
    { "name": "房租", "type": "fixed", "amount": 3500, "enabled": true, "isRent": true },
    { "name": "水费", "type": "manual", "amount": 0, "enabled": true, "isRent": false }
  ]
}
```

返回：更新后的 `FeeItem[]`。

---

## 全局规则

1. **所有 type 字段在 API 层做 number → string 转换**，数据库存 number 不变
2. **所有 boolean 字段做 0/1 → true/false 转换**
3. **日期字段统一返回 ISO string**
4. **金额单位：元（不是分）**
5. **API 前缀：`/api`**（由 main.ts setGlobalPrefix 处理）
