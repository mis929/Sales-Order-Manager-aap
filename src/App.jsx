import { useState, useEffect } from "react";
import "./App.css";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const API_URL = "https://script.google.com/macros/s/AKfycbzfBvjA4dZIz8Gn3_BLBwnE2H1dvwVCKci2mi7_3Xnx8Y1D6yTydrm_h8TVkH6Rloc8/exec";

const fields = [
  { key: "Order ID", type: "text" },
  { key: "Date", type: "date" },
  { key: "Customer Name", type: "text" },
  { key: "Address", type: "text" },
  { key: "Customer Email", type: "email" },
  { key: "Customer Phone", type: "text" },
  { key: "GSTIN", type: "text" },
  { key: "Item Name", type: "text" },
  { key: "Quantity", type: "number" },
  { key: "Unit Price", type: "number" },
  { key: "Discount %", type: "number" },
  { key: "Tax %", type: "number" },
  { key: "Subtotal", type: "number" },
  { key: "Tax Amount", type: "number" },
  { key: "Total", type: "number" },
  { key: "Payment Method", type: "text" },
  { key: "Status", type: "text" },
  { key: "Notes", type: "text" },
];

const getTodayDate = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const emptyForm = () => ({
  ...Object.fromEntries(fields.map(f => [f.key, ""])),
  "Date": getTodayDate(),
  "Address Type": "",
  "Address": "",
});

export default function App() {
  const [user, setUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [editRow, setEditRow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [nextOrderNum, setNextOrderNum] = useState(1);
  const [itemsList, setItemsList] = useState([]);
  const [itemRows, setItemRows] = useState([
    { id: 1, category: "", item: "", packing: "", qty: "", priceType: "PC", pricePerBox: "", total: "" }
  ]);
  const [customersList, setCustomersList] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem("salesman_user");
    if (saved) { setUser(JSON.parse(saved)); }
  }, []);

  useEffect(() => {
    if (user) {
      fetchOrders();
      fetchItems();
      fetchCustomers();
    }
  }, [user]);

  const fetchItems = async () => {
    try {
      const res = await fetch(`${API_URL}?action=getItems`);
      const data = await res.json();
      if (data.success && data.items.length > 0) {
        setItemsList(data.items);
      }
    } catch {
      console.log("Items could not be loaded");
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API_URL}?action=getCustomers&salesman_id=${user.salesman_id}`);
      const data = await res.json();
      if (data.success && data.customers) {
        setCustomersList(data.customers);
      }
    } catch {
      console.log("Customers could not be loaded");
    }
  };

  const generateOrderId = (sid, num) => {
    return `${String(sid).toUpperCase()}-${num}`;
  };

  const handleLogin = async () => {
    if (!loginForm.email || !loginForm.password) {
      setLoginError("Please enter email and password!");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=login`, {
        method: "POST",
        body: JSON.stringify(loginForm),
        headers: { "Content-Type": "text/plain" }
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("salesman_user", JSON.stringify(data.user));
        setUser(data.user);
        setLoginError("");
      } else {
        setLoginError(data.message || "Login failed!");
      }
    } catch {
      setLoginError("Unable to connect to server!");
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("salesman_user");
    setUser(null);
    setOrders([]);
    setNextOrderNum(1);
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=getAll&salesman_id=${user.salesman_id}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.data);
        const maxNum = data.data.reduce((max, o) => {
          const id = String(o["Order ID"] || "");
          let n = 0;
          if (id.includes("-")) {
            const parts = id.split("-");
            n = parseInt(parts[parts.length - 1]) || 0;
          } else {
            n = parseInt(id) || 0;
          }
          return n > max ? n : max;
        }, 0);
        setNextOrderNum(maxNum + 1);
      }
    } catch {
      setMsg("❌ Failed to load data!");
    }
    setLoading(false);
  };

  const calcAuto = (f) => {
    const qty = parseFloat(f["Quantity"]) || 0;
    const price = parseFloat(f["Unit Price"]) || 0;
    const disc = parseFloat(f["Discount %"]) || 0;
    const tax = parseFloat(f["Tax %"]) || 0;
    const subtotal = qty * price * (1 - disc / 100);
    const taxAmt = subtotal * tax / 100;
    const total = subtotal + taxAmt;
    return {
      ...f,
      "Subtotal": subtotal.toFixed(2),
      "Tax Amount": taxAmt.toFixed(2),
      "Total": total.toFixed(2)
    };
  };

  // ✅ Customer select - Delivery Address 1 default
  const handleCustomerSelect = (customerCode) => {
    if (!customerCode) {
      setForm(prev => ({
        ...prev,
        "Customer Name": "",
        "Address": "",
        "Address Type": "",
        "Customer Email": "",
        "Customer Phone": "",
        "GSTIN": "",
        "_address1": "",
        "_address2": "",
        "_address3": "",
      }));
      return;
    }
    const selected = customersList.find(c => c.code === customerCode);
    if (selected) {
      setForm(prev => ({
        ...prev,
        "Customer Name": selected.name || "",
        "Address Type": "Delivery Address 1",        // ✅ Default
        "Address": selected.address1 || "",           // ✅ Default address
        "Customer Email": selected.email || "",
        "Customer Phone": selected.phone || "",
        "GSTIN": selected.gstin || "",
        "_address1": selected.address1 || "",
        "_address2": selected.address2 || "",
        "_address3": selected.address3 || "",
      }));
    }
  };

  // ✅ Address Type change - Delivery Address 1, 2, 3
  const handleAddressTypeChange = (type) => {
    let addr = "";
    if (type === "Delivery Address 1") addr = form["_address1"] || "";
    if (type === "Delivery Address 2") addr = form["_address2"] || "";
    if (type === "Delivery Address 3") addr = form["_address3"] || "";
    setForm(prev => ({ ...prev, "Address Type": type, "Address": addr }));
  };

  const getCategories = () => [...new Set(itemsList.map(i => i.category).filter(Boolean))];

  const getItemsByCategory = (category) => itemsList.filter(i => i.category === category);

  const handleItemRowChange = (id, field, value) => {
    setItemRows(prev => prev.map(row => {
      if (row.id !== id) return row;
      const updated = { ...row, [field]: value };
      if (field === "category") { updated.item = ""; updated.packing = ""; }
      if (field === "item") {
        const found = itemsList.find(i => i.name === value);
        updated.packing = found ? found.code : "";
      }
      const qty = parseFloat(field === "qty" ? value : updated.qty) || 0;
      const price = parseFloat(field === "pricePerBox" ? value : updated.pricePerBox) || 0;
      updated.total = qty && price ? (qty * price).toFixed(2) : "";
      return updated;
    }));
  };

  const addItemRow = () => {
    setItemRows(prev => [...prev, {
      id: Date.now(), category: "", item: "", packing: "", qty: "",
      priceType: "PC", pricePerBox: "", total: ""
    }]);
  };

  const deleteItemRow = (id) => {
    setItemRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);
  };

  const copyItemRow = (row) => {
    setItemRows(prev => [...prev, { ...row, id: Date.now() }]);
  };

  const totalQty = itemRows.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0);
  const totalAmt = itemRows.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);

  const handleChange = (key, value) => {
    const updated = { ...form, [key]: value };
    if (["Quantity", "Unit Price", "Discount %", "Tax %"].includes(key)) {
      setForm(calcAuto(updated));
    } else {
      setForm(updated);
    }
  };

  const generatePDF = (formData, rows) => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFillColor(26, 115, 232);
    doc.rect(0, 0, pageW, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("SALE ORDER", pageW / 2, 12, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Order ID: ${formData["Order ID"]}`, pageW / 2, 21, { align: "center" });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Customer Details", 14, 38);
    doc.setDrawColor(26, 115, 232);
    doc.line(14, 40, pageW - 14, 40);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const details = [
      ["Customer Name", formData["Customer Name"] || "-"],
      ["Date", formData["Date"] || "-"],
      ["Address Type", formData["Address Type"] || "-"],
      ["Address", formData["Address"] || "-"],
      ["Customer Email", formData["Customer Email"] || "-"],
      ["Customer Phone", formData["Customer Phone"] || "-"],
      ["GSTIN", formData["GSTIN"] || "-"],
    ];
    let y = 47;
    details.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(value), 60, y);
      y += 7;
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Item Details", 14, y + 6);
    doc.line(14, y + 8, pageW - 14, y + 8);

    const tableRows = rows
      .filter(r => r.item)
      .map((r, i) => [
        i + 1, r.category, r.item, r.packing, r.qty, r.priceType, r.pricePerBox,
        r.total ? `${parseFloat(r.total).toLocaleString("en-IN")}` : "-"
      ]);

    const totalQtyPdf = rows.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0);
    const totalAmtPdf = rows.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);

    autoTable(doc, {
      startY: y + 11,
      head: [["#", "Category", "Item", "Packing", "Qty", "Price Type", "Price/Box", "Total"]],
      body: tableRows,
      foot: [["", "", "", "Total", totalQtyPdf, "", "", `${totalAmtPdf.toLocaleString("en-IN")}`]],
      styles: { fontSize: 8.5, cellPadding: 3 },
      headStyles: { fillColor: [26, 115, 232], textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [232, 240, 254], textColor: [26, 115, 232], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 255] },
    });

    if (formData["Notes"]) {
      const finalY = doc.lastAutoTable.finalY + 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Notes:", 14, finalY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(formData["Notes"], 14, finalY + 6, { maxWidth: pageW - 28 });
    }

    const pgH = doc.internal.pageSize.getHeight();
    doc.setFillColor(26, 115, 232);
    doc.rect(0, pgH - 12, pageW, 12, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text("Generated by Sale Orders Manager", pageW / 2, pgH - 4, { align: "center" });

    doc.save(`Order_${formData["Order ID"]}.pdf`);
    return doc.output("datauristring").split(",")[1];
  };

  const handleSubmit = async () => {
    if (!form["Order ID"] || !form["Customer Name"]) {
      setMsg("⚠️ Order ID and Customer Name are required!"); return;
    }
    setLoading(true);
    try {
      const action = editRow ? "update" : "add";
      const payload = editRow
        ? { ...form, _rowIndex: editRow._rowIndex, salesman_id: user.salesman_id }
        : { ...form, salesman_id: user.salesman_id };
      await fetch(`${API_URL}?action=${action}`, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "text/plain" }
      });
      setMsg(editRow ? "✅ Updated successfully!" : "✅ Order added successfully!");
      const pdfBase64 = generatePDF(form, itemRows);
      if (pdfBase64) {
        fetch(`${API_URL}?action=savePdfLink`, {
          method: "POST",
          body: JSON.stringify({
            orderId: form["Order ID"],
            pdfBase64: pdfBase64,
            salesman_id: user.salesman_id
          }),
          headers: { "Content-Type": "text/plain" }
        }).catch(() => console.log("PDF link save failed"));
      }
      setForm(emptyForm());
      setItemRows([{ id: 1, category: "", item: "", packing: "", qty: "", priceType: "PC", pricePerBox: "", total: "" }]);
      setEditRow(null);
      setShowForm(false);
      setTimeout(() => fetchOrders(), 1000);
    } catch {
      setMsg("❌ An error occurred!");
    }
    setLoading(false);
    setTimeout(() => setMsg(""), 3000);
  };

  const handleEdit = (row) => {
    const f = {};
    fields.forEach(({ key }) => {
      f[key] = row[key] !== undefined && row[key] !== null ? String(row[key]) : "";
    });
    setForm(f);
    setEditRow(row);
    setShowForm(true);
    window.scrollTo(0, 0);
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete order for "${row["Customer Name"]}"?`)) return;
    setLoading(true);
    try {
      await fetch(`${API_URL}?action=delete`, {
        method: "POST",
        body: JSON.stringify({ _rowIndex: row._rowIndex }),
        headers: { "Content-Type": "text/plain" }
      });
      setMsg("✅ Deleted successfully!");
      setTimeout(() => fetchOrders(), 1000);
    } catch {
      setMsg("❌ Delete failed!");
    }
    setLoading(false);
    setTimeout(() => setMsg(""), 3000);
  };

  const filtered = orders.filter(o => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return Object.values(o).some(v =>
      v !== null && v !== undefined && String(v).toLowerCase().includes(q)
    );
  });

  // LOGIN PAGE
  if (!user) {
    return (
      <div className="login-wrap">
        <div className="login-box">
          <h1>📦 Sale Orders</h1>
          <p className="login-sub">Login to your account</p>
          {loginError && <div className="login-error">{loginError}</div>}
          <div className="login-field">
            <label>Email</label>
            <input type="email" placeholder="your@email.com"
              value={loginForm.email}
              onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
            />
          </div>
          <div className="login-field">
            <label>Password</label>
            <input type="password" placeholder="Enter password"
              value={loginForm.password}
              onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
            />
          </div>
          <button className="login-btn" onClick={handleLogin} disabled={loading}>
            {loading ? "Logging in..." : "LOGIN"}
          </button>
        </div>
      </div>
    );
  }

  // MAIN APP
  return (
    <div className="app">
      <header>
        <h1>📦 Sale Orders Manager</h1>
        <div className="header-right">
          <span className="user-info">👤 {user.name} ({user.salesman_id})</span>
          <button className="btn-add" onClick={async () => {
            const opening = !showForm;
            setShowForm(opening);
            setEditRow(null);
            if (opening) {
              try {
                const res = await fetch(`${API_URL}?action=getNextOrderNum&salesman_id=${user.salesman_id}`);
                const data = await res.json();
                const num = data.success ? data.nextNum : nextOrderNum;
                setNextOrderNum(num);
                const newId = generateOrderId(user.salesman_id, num);
                setForm({ ...emptyForm(), "Order ID": newId });
              } catch {
                const newId = generateOrderId(user.salesman_id, nextOrderNum);
                setForm({ ...emptyForm(), "Order ID": newId });
              }
            } else {
              setForm(emptyForm());
            }
          }}>
            {showForm ? "✖ CLOSE" : "+ NEW ORDER"}
          </button>
          <button className="btn-logout" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {msg && <div className="msg">{msg}</div>}

      {showForm && (
        <div className="form-box">
          <h2>{editRow ? "✏️ Edit Order" : "➕ New Order"}</h2>
          <div className="form-grid">

            {/* ORDER ID */}
            <div className="form-group col-small">
              <label>Order ID</label>
              <input type="text" value={form["Order ID"]} readOnly />
            </div>

            {/* DATE */}
            <div className="form-group col-small">
              <label>Date</label>
              <input type="date" value={form["Date"]}
                onChange={e => handleChange("Date", e.target.value)} />
            </div>

            {/* CUSTOMER NAME */}
            <div className="form-group col-2">
              <label>Customer Name</label>
              {customersList.length > 0 ? (
                <select
                  value={customersList.find(c => c.name === form["Customer Name"])?.code || ""}
                  onChange={e => handleCustomerSelect(e.target.value)}
                >
                  <option value="">-- Select Customer --</option>
                  {customersList.map((c, idx) => (
                    <option key={idx} value={c.code}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input type="text" placeholder="Customer Name"
                  value={form["Customer Name"]}
                  onChange={e => handleChange("Customer Name", e.target.value)} />
              )}
            </div>

            {/* ✅ ADDRESS TYPE - Delivery Address 1, 2, 3 */}
            <div className="form-group">
              <label>Address Type</label>
              <select
                value={form["Address Type"]}
                onChange={e => handleAddressTypeChange(e.target.value)}
              >
                <option value="">-- Select --</option>
                <option value="Delivery Address 1">Delivery Address 1</option>
                <option value="Delivery Address 2">Delivery Address 2</option>
                <option value="Delivery Address 3">Delivery Address 3</option>
              </select>
            </div>

            {/* ✅ ADDRESS - Hamesha dikhega, Address Type ke saath */}
            <div className="form-group form-group-full">
              <label>
                Address {form["Address Type"] ? `(${form["Address Type"]})` : ""}
              </label>
              <input
                type="text"
                placeholder="Address"
                value={form["Address"]}
                onChange={e => handleChange("Address", e.target.value)}
              />
            </div>

            {/* CUSTOMER EMAIL */}
            <div className="form-group">
              <label>Customer Email</label>
              <input type="email" placeholder="Customer Email"
                value={form["Customer Email"]}
                onChange={e => handleChange("Customer Email", e.target.value)} />
            </div>

            {/* CUSTOMER PHONE */}
            <div className="form-group">
              <label>Customer Phone</label>
              <input type="text" placeholder="Customer Phone"
                value={form["Customer Phone"]}
                onChange={e => handleChange("Customer Phone", e.target.value)} />
            </div>

            {/* GSTIN */}
            <div className="form-group">
              <label>GSTIN</label>
              <input type="text" placeholder="GSTIN"
                value={form["GSTIN"]}
                onChange={e => handleChange("GSTIN", e.target.value)} />
            </div>

          </div>

          {/* ITEM TABLE */}
          <div className="item-table-wrap">
            <div className="item-table-header">
              <span>Item Details</span>
              <button className="btn-add-row" onClick={addItemRow}>+ Add Row</button>
            </div>
            <div className="item-table-scroll">
              <table className="item-table">
                <thead>
                  <tr>
                    <th>Item Category</th>
                    <th>Item</th>
                    <th>Packing/Box</th>
                    <th>Quantity</th>
                    <th>Price Type</th>
                    <th>Price/Box</th>
                    <th>Total Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {itemRows.map(row => (
                    <tr key={row.id}>
                      <td>
                        <select value={row.category} onChange={e => handleItemRowChange(row.id, "category", e.target.value)}>
                          <option value="">-- Select --</option>
                          {getCategories().map((cat, i) => <option key={i} value={cat}>{cat}</option>)}
                        </select>
                      </td>
                      <td>
                        <select value={row.item} onChange={e => handleItemRowChange(row.id, "item", e.target.value)}>
                          <option value="">-- Select --</option>
                          {getItemsByCategory(row.category).map((it, i) => (
                            <option key={i} value={it.name}>{it.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input type="text" value={row.packing} readOnly placeholder="-" />
                      </td>
                      <td>
                        <input type="number" value={row.qty} placeholder="0"
                          onChange={e => handleItemRowChange(row.id, "qty", e.target.value)} />
                      </td>
                      <td>
                        <select value={row.priceType} onChange={e => handleItemRowChange(row.id, "priceType", e.target.value)}>
                          <option value="PC">PC</option>
                          <option value="Box">Box</option>
                          <option value="KG">KG</option>
                          <option value="Roll">Roll</option>
                        </select>
                      </td>
                      <td>
                        <input type="number" value={row.pricePerBox} placeholder="0"
                          onChange={e => handleItemRowChange(row.id, "pricePerBox", e.target.value)} />
                      </td>
                      <td>
                        <input type="number" value={row.total} readOnly placeholder="0" />
                      </td>
                      <td className="action-btns">
                        <button className="btn-copy-row" onClick={() => copyItemRow(row)}>Copy</button>
                        <button className="btn-del-row" onClick={() => deleteItemRow(row.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="3"><strong>Total</strong></td>
                    <td><strong>{totalQty}</strong></td>
                    <td colSpan="2"></td>
                    <td><strong>{totalAmt > 0 ? totalAmt.toFixed(2) : ""}</strong></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* NOTES */}
          <div className="notes-wrap">
            <label className="notes-label">📝 Notes</label>
            <textarea
              placeholder="Order notes yahan likhein..."
              value={form["Notes"]}
              onChange={e => handleChange("Notes", e.target.value)}
              rows={3}
            />
          </div>

          <div className="form-btns">
            <button className="btn-save" onClick={handleSubmit} disabled={loading}>
              {loading ? "Saving..." : editRow ? "UPDATE" : "SAVE"}
            </button>
            <button className="btn-cancel" onClick={() => {
              setShowForm(false); setForm(emptyForm()); setEditRow(null);
            }}>Cancel</button>
          </div>
        </div>
      )}

    </div>
  );
}