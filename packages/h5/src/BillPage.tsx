import { useEffect, useState } from 'react';
import { fetchBillByToken, type ShareBillPayload } from './api';

function getQueryParam(name: string): string {
  const search = new URLSearchParams(window.location.search);
  return search.get(name) || '';
}

function formatPeriod(period: string): string {
  // "2026-06" → "2026年6月"
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  return `${m[1]}年${parseInt(m[2], 10)}月`;
}

const QR_LABEL: Record<string, string> = {
  wechat: '微信',
  alipay: '支付宝',
  bank: '银行卡',
};

export default function BillPage() {
  const token = getQueryParam('token');
  const [data, setData] = useState<ShareBillPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!token) {
      setError('缺少账单参数');
      setLoading(false);
      return;
    }
    fetchBillByToken(token)
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message || '加载失败');
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="page">
        <div className="loading">加载中…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="error-card">
          <div className="error-title">无法打开账单</div>
          <div className="error-desc">{error}</div>
          <div className="error-hint">请联系房东重新发送链接</div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const remaining = Math.max(0, data.totalAmount - data.paidAmount);

  return (
    <div className="page">
      <div className="header">
        <div className="header-room">{data.roomName}</div>
        <div className="header-period">{formatPeriod(data.period)} 账单</div>
        {data.tenantName && <div className="header-tenant">租客：{data.tenantName}</div>}
      </div>

      <div className="amount-card">
        <div className="amount-label">应付金额</div>
        <div className="amount-value">
          <span className="amount-number">{data.totalAmount.toLocaleString()}</span>
          <span className="amount-unit">元</span>
        </div>
        {data.paidAmount > 0 && (
          <div className="amount-paid-row">
            已付 {data.paidAmount.toLocaleString()} 元
            {remaining > 0 && <span className="amount-remaining">，待付 {remaining.toLocaleString()} 元</span>}
          </div>
        )}
      </div>

      <div className="items-card">
        <div className="items-title">账单明细</div>
        {data.items.map((item, idx) => (
          <div key={idx} className="item-row">
            <span className="item-name">{item.name}</span>
            <span className="item-amount">{item.amount.toLocaleString()} 元</span>
          </div>
        ))}
      </div>

      {data.qrCodes.length > 0 ? (
        <div className="qr-card">
          <div className="qr-title">长按二维码识别付款</div>
          {data.qrCodes.map((code, idx) => (
            <div key={idx} className="qr-item">
              <img className="qr-img" src={code.imageUrl} alt={code.type} />
              <div className="qr-meta">
                <div className="qr-type">{QR_LABEL[code.type] || code.type}</div>
                <div className="qr-payee">收款人：{code.payeeName || data.payeeName || data.landlordName}</div>
              </div>
            </div>
          ))}
          <div className="qr-hint">付款后请告诉房东，方便核对</div>
        </div>
      ) : (
        <div className="qr-card">
          <div className="qr-title">房东暂未设置收款码</div>
          <div className="qr-hint">请联系房东告知付款方式</div>
        </div>
      )}

      {data.paymentNote && (
        <div className="note-card">
          <div className="note-label">房东备注</div>
          <div className="note-text">{data.paymentNote}</div>
        </div>
      )}

      <div className="footer">
        <div className="footer-text">本账单由「五联人家」生成 · 仅供付款参考</div>
      </div>
    </div>
  );
}
