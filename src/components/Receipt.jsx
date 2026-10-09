// Reusable printable receipt. Pass the sale/order data in; window.print()
// picks up only the .receipt-printable block thanks to the @media print
// rules in styles.css, so the rest of the app is hidden on the printed page.
export default function Receipt({ businessName, branchName, saleId, dateTime, items, totalAmount, paymentMethod, tableNumber, customerName, serverName, cashierName, onClose }) {
  return (
    <div>
      <div className="receipt-printable">
        <div className="receipt-box">
          <h3>{businessName}</h3>
          <div className="sub">{branchName}</div>
          <div className="sub">{new Date(dateTime).toLocaleString([], { timeZone: "Africa/Nairobi" })}</div>
          {tableNumber && <div className="sub">Table {tableNumber}</div>}
          {serverName && <div className="sub">Served by {serverName}</div>}
          {cashierName && <div className="sub">Cashier: {cashierName}</div>}
          {customerName && <div className="sub">{customerName}</div>}
          <div className="sub">Receipt #{saleId}</div>
          <hr style={{ border: "none", borderTop: "1px dashed #999", margin: "10px 0" }} />

          {items.map((item, i) => (
            <div className="receipt-line" key={i}>
              <span>{item.product_name} x{item.quantity}</span>
              <span>{Number(item.subtotal).toLocaleString()}</span>
            </div>
          ))}

          <div className="receipt-total">
            <span>TOTAL</span>
            <span>KSh {Number(totalAmount).toLocaleString()}</span>
          </div>
          <div className="sub" style={{ marginTop: 8 }}>
            Paid via {paymentMethod === "mpesa_till" ? "M-Pesa Till" : "Cash"}
          </div>
          <div className="sub" style={{ marginTop: 12 }}>Thank you for your business</div>
        </div>
      </div>

      <div className="no-print" style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button className="btn" onClick={() => window.print()}>Print Receipt</button>
        <button className="btn" style={{ background: "#ddd6c9", color: "#333" }} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
