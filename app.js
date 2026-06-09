// BANQUET SEATING APP LOGIC

// 1. STATE MANAGEMENT
let seatingData = []; // Array of 20 tables, each having an array of 8 seat objects: { id: 1..8, name: "" }
let appBaseUrl = "";
let selectedDelegate = null; // { name, tableIndex, seatIndex }

// Clean Vietnamese signs for search matching
function removeVietnameseTones(str) {
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|U|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  str = str.replace(/Đ/g, "D");
  // Some system encode combiner characters
  str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); // Huyền, sắc, ngã, hỏi, nặng
  str = str.replace(/\u02C6|\u0306|\u031B/g, ""); // Â, Ă, Ơ, Ư
  // Remove spaces and special chars if needed, but here we just convert to lowercase for comparison
  return str.toLowerCase().trim();
}

// Initialize default data
function initDefaultData() {
  const localData = localStorage.getItem('banquet_seating_data');
  if (localData) {
    try {
      seatingData = JSON.parse(localData);
    } catch (e) {
      console.error("Lỗi parse data local, tạo mới.", e);
      generateEmptyData();
    }
  } else {
    generateEmptyData();
  }

  // App URL setup
  const savedUrl = localStorage.getItem('banquet_app_url');
  if (savedUrl) {
    appBaseUrl = savedUrl;
  } else {
    // Fallback to current window origin + path
    appBaseUrl = window.location.origin + window.location.pathname.replace(/\/$/, "");
  }
  document.getElementById('app-base-url').value = appBaseUrl;
}

function generateEmptyData() {
  seatingData = [];
  for (let t = 1; t <= 20; t++) {
    const seats = [];
    for (let s = 1; s <= 8; s++) {
      seats.push({ id: s, name: "" });
    }
    seatingData.push({
      tableNumber: t,
      seats: seats
    });
  }
  saveToLocalStorage();
}

function saveToLocalStorage() {
  localStorage.setItem('banquet_seating_data', JSON.stringify(seatingData));
  updateStats();
}

function saveAppUrl() {
  const urlInput = document.getElementById('app-base-url').value.trim();
  appBaseUrl = urlInput || (window.location.origin + window.location.pathname.replace(/\/$/, ""));
  localStorage.setItem('banquet_app_url', appBaseUrl);
}

// 2. RENDERING VIEWS
function renderGuestLayout() {
  const container = document.getElementById('tables-container');
  container.innerHTML = "";

  seatingData.forEach((table, tIndex) => {
    const occupiedCount = table.seats.filter(s => s.name.trim() !== "").length;
    
    const tableNode = document.createElement('div');
    tableNode.className = 'table-node';
    tableNode.id = `table-${table.tableNumber}`;
    tableNode.onclick = () => openTableModal(tIndex);

    // Render table text
    tableNode.innerHTML = `
      <span class="table-num">Mâm ${table.tableNumber}</span>
      <span class="table-count">${occupiedCount}/8</span>
    `;

    // Render 8 mini seats around the table node
    const seatsIndicator = document.createElement('div');
    seatsIndicator.className = 'mini-seats-indicator';
    
    for (let s = 0; s < 8; s++) {
      const angle = (s * 45 - 90) * (Math.PI / 180);
      // Position mini seats radially
      const radius = 52; // percentage/offset
      const x = 50 + radius * Math.cos(angle);
      const y = 50 + radius * Math.sin(angle);
      
      const seatPill = document.createElement('div');
      seatPill.className = 'mini-seat';
      
      const isOccupied = table.seats[s].name.trim() !== "";
      if (isOccupied) {
        seatPill.classList.add('occupied');
      }
      
      // Keep ID to highlight specifically
      seatPill.id = `mini-seat-${table.tableNumber}-${s + 1}`;
      seatPill.style.left = `${x}%`;
      seatPill.style.top = `${y}%`;
      
      seatsIndicator.appendChild(seatPill);
    }
    
    tableNode.appendChild(seatsIndicator);
    container.appendChild(tableNode);
  });
}

function renderAdminTableList() {
  const container = document.getElementById('admin-tables-container');
  container.innerHTML = "";

  seatingData.forEach((table, tIndex) => {
    const row = document.createElement('div');
    row.className = 'admin-table-row';

    // Label and quick QR
    const labelCol = document.createElement('div');
    labelCol.className = 'admin-table-label-col';
    labelCol.innerHTML = `
      <div class="admin-table-label">Mâm ${table.tableNumber}</div>
      <button class="btn btn-secondary" style="padding: 6px 10px; font-size: 0.75rem; margin-top: 5px;" onclick="generateTableQr(${table.tableNumber})">
        <i class="fa-solid fa-qrcode"></i> QR Mâm
      </button>
    `;
    row.appendChild(labelCol);

    // 8 seat inputs
    const seatsGrid = document.createElement('div');
    seatsGrid.className = 'admin-seats-grid';

    table.seats.forEach((seat, sIndex) => {
      const seatBox = document.createElement('div');
      seatBox.className = 'seat-input-container';

      // Input field
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'seat-name-input';
      input.value = seat.name;
      input.placeholder = `Ghế ${seat.id}...`;
      input.oninput = (e) => updateSeatName(tIndex, sIndex, e.target.value);

      // Mini actions for individual seats (like QR generator for seat)
      const qrBtn = document.createElement('button');
      qrBtn.style.background = 'none';
      qrBtn.style.border = 'none';
      qrBtn.style.color = seat.name.trim() !== "" ? 'var(--gold-main)' : 'rgba(255,255,255,0.1)';
      qrBtn.style.cursor = seat.name.trim() !== "" ? 'pointer' : 'default';
      qrBtn.disabled = seat.name.trim() === "";
      qrBtn.title = seat.name.trim() !== "" ? `Tạo QR cho ${seat.name}` : "";
      qrBtn.innerHTML = `<i class="fa-solid fa-qrcode"></i>`;
      qrBtn.onclick = () => generateDelegateQr(seat.name, table.tableNumber, seat.id);

      seatBox.innerHTML = `<span class="seat-num-indicator">${seat.id}</span>`;
      seatBox.appendChild(input);
      seatBox.appendChild(qrBtn);
      seatsGrid.appendChild(seatBox);
    });

    row.appendChild(seatsGrid);
    container.appendChild(row);
  });
}

function updateSeatName(tIndex, sIndex, name) {
  seatingData[tIndex].seats[sIndex].name = name;
  saveToLocalStorage();
  // Live render guest view in background
  renderGuestLayout();
  
  // Update disabled state of individual QR buttons in Admin row
  const row = document.getElementById('admin-tables-container').children[tIndex];
  const seatGrid = row.querySelector('.admin-seats-grid');
  const seatBox = seatGrid.children[sIndex];
  const qrBtn = seatBox.querySelector('button');
  if (name.trim() !== "") {
    qrBtn.style.color = 'var(--gold-main)';
    qrBtn.style.cursor = 'pointer';
    qrBtn.disabled = false;
    qrBtn.onclick = () => generateDelegateQr(name, seatingData[tIndex].tableNumber, sIndex + 1);
  } else {
    qrBtn.style.color = 'rgba(255,255,255,0.1)';
    qrBtn.style.cursor = 'default';
    qrBtn.disabled = true;
  }
}

function updateStats() {
  let assignedCount = 0;
  seatingData.forEach(table => {
    table.seats.forEach(seat => {
      if (seat.name.trim() !== "") {
        assignedCount++;
      }
    });
  });
  const statsEl = document.getElementById('stats-assigned');
  if (statsEl) statsEl.textContent = assignedCount;
}

// 3. SEARCH & HIGHLIGHT
function onSearchInput() {
  const query = removeVietnameseTones(document.getElementById('search-input').value);
  const resultsDropdown = document.getElementById('search-results');
  
  if (!query) {
    resultsDropdown.style.display = 'none';
    return;
  }

  // Find matching delegates
  const matches = [];
  seatingData.forEach((table, tIndex) => {
    table.seats.forEach((seat, sIndex) => {
      if (seat.name.trim() !== "") {
        const normalizedName = removeVietnameseTones(seat.name);
        if (normalizedName.includes(query)) {
          matches.push({
            name: seat.name,
            tableNumber: table.tableNumber,
            seatId: seat.id,
            tIndex,
            sIndex
          });
        }
      }
    });
  });

  if (matches.length === 0) {
    resultsDropdown.innerHTML = `<div class="result-item" style="color: var(--text-secondary); cursor: default;">Không tìm thấy đại biểu</div>`;
    resultsDropdown.style.display = 'block';
    return;
  }

  // Render suggestion items
  resultsDropdown.innerHTML = "";
  matches.forEach(match => {
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <span>${match.name}</span>
      <span class="table-badge">Mâm ${match.tableNumber} - Ghế ${match.seatId}</span>
    `;
    item.onclick = () => selectDelegate(match);
    resultsDropdown.appendChild(item);
  });
  resultsDropdown.style.display = 'block';
}

function selectDelegate(delegate) {
  selectedDelegate = delegate;
  document.getElementById('search-input').value = delegate.name;
  document.getElementById('clear-search').style.display = 'block';
  document.getElementById('search-results').style.display = 'none';

  // Highlight welcome card
  document.getElementById('welcome-name').textContent = delegate.name;
  document.getElementById('welcome-table').textContent = delegate.tableNumber;
  document.getElementById('welcome-seat').textContent = delegate.seatId;
  document.getElementById('welcome-card').style.display = 'block';

  // Remove existing highlights from all table nodes and mini seats
  document.querySelectorAll('.table-node').forEach(n => n.classList.remove('highlighted'));
  document.querySelectorAll('.mini-seat').forEach(s => s.classList.remove('active-target'));

  // Highlight the target table node
  const tableNode = document.getElementById(`table-${delegate.tableNumber}`);
  if (tableNode) {
    tableNode.classList.add('highlighted');
    tableNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Highlight the mini seat in the table node layout
  const miniSeat = document.getElementById(`mini-seat-${delegate.tableNumber}-${delegate.seatId}`);
  if (miniSeat) {
    miniSeat.classList.add('active-target');
  }
}

function clearSearch() {
  selectedDelegate = null;
  document.getElementById('search-input').value = "";
  document.getElementById('clear-search').style.display = 'none';
  document.getElementById('welcome-card').style.display = 'none';
  document.getElementById('search-results').style.display = 'none';

  // Remove highlights
  document.querySelectorAll('.table-node').forEach(n => n.classList.remove('highlighted'));
  document.querySelectorAll('.mini-seat').forEach(s => s.classList.remove('active-target'));
}

function focusAssignedSeat() {
  if (selectedDelegate) {
    openTableModal(selectedDelegate.tIndex);
  }
}

// 4. ZOOM MODAL (DETAIL MAP OVERLAY)
function openTableModal(tIndex) {
  const table = seatingData[tIndex];
  document.getElementById('modal-table-title').textContent = `MÂM TIỆC SỐ ${table.tableNumber}`;
  document.getElementById('center-table-label').textContent = `MÂM ${table.tableNumber}`;
  
  const ring = document.getElementById('modal-seats-ring');
  ring.innerHTML = "";

  const listContainer = document.getElementById('modal-seats-list');
  listContainer.innerHTML = "";

  // Render 8 circular seat nodes
  for (let i = 0; i < 8; i++) {
    const seat = table.seats[i];
    const angle = (i * 45 - 90) * (Math.PI / 180);
    const radius = 125; // pixels in absolute width (ring container is 320x320, radius 125 keeps them on border)
    const x = 160 + radius * Math.cos(angle);
    const y = 160 + radius * Math.sin(angle);

    const seatNode = document.createElement('div');
    seatNode.className = 'seat-node';
    seatNode.style.left = `${x}px`;
    seatNode.style.top = `${y}px`;

    // Detect if this seat is the highlighted one
    const isTarget = selectedDelegate && 
                     selectedDelegate.tableNumber === table.tableNumber && 
                     selectedDelegate.seatId === seat.id;
    
    if (isTarget) {
      seatNode.classList.add('active-target');
    }

    const nameText = seat.name.trim();
    if (nameText === "") {
      seatNode.classList.add('empty');
      seatNode.innerHTML = `
        <span class="seat-num">${seat.id}</span>
        <span class="seat-name">Trống</span>
      `;
    } else {
      seatNode.innerHTML = `
        <span class="seat-num">${seat.id}</span>
        <span class="seat-name">${nameText}</span>
      `;
    }

    ring.appendChild(seatNode);

    // List item below the circle
    const listItem = document.createElement('div');
    listItem.className = `modal-list-item ${isTarget ? 'highlight' : ''}`;
    listItem.innerHTML = `
      <span>Ghế ${seat.id}</span>
      <span>${nameText || '<i>Trống</i>'}</span>
    `;
    listContainer.appendChild(listItem);
  }

  document.getElementById('table-modal').classList.add('active');
}

function closeModal(e) {
  if (e === null || e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close')) {
    document.getElementById('table-modal').classList.remove('active');
  }
}

// 5. BULK IMPORT & RESET & CONFIGS
function processBulkImport() {
  const rawText = document.getElementById('bulk-names-input').value;
  const names = rawText.split('\n')
                       .map(line => line.trim())
                       .filter(line => line.length > 0);

  if (names.length === 0) {
    alert("Vui lòng nhập danh sách tên đại biểu trước!");
    return;
  }

  if (names.length > 160) {
    alert(`Số lượng đại biểu nhập vào là ${names.length}, vượt quá giới hạn 160 ghế của 20 mâm. Chỉ 160 đại biểu đầu tiên được xếp.`);
  }

  // Clear data and auto distribute
  generateEmptyData();

  let nameIndex = 0;
  for (let t = 0; t < 20 && nameIndex < names.length; t++) {
    for (let s = 0; s < 8 && nameIndex < names.length; s++) {
      seatingData[t].seats[s].name = names[nameIndex];
      nameIndex++;
    }
  }

  saveToLocalStorage();
  renderGuestLayout();
  renderAdminTableList();
  alert(`Đã phân bổ thành công ${Math.min(names.length, 160)} đại biểu vào 20 mâm!`);
  document.getElementById('bulk-names-input').value = "";
}

function resetAllData() {
  if (confirm("Bạn có chắc chắn muốn xóa toàn bộ danh sách đại biểu đã xếp? Thao tác này không thể hoàn tác.")) {
    generateEmptyData();
    renderGuestLayout();
    renderAdminTableList();
    clearSearch();
    alert("Đã xóa toàn bộ dữ liệu.");
  }
}

function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(seatingData));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  
  const date = new Date().toISOString().slice(0, 10);
  downloadAnchor.setAttribute("download", `so-do-mam-co-${date}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (Array.isArray(parsed) && parsed.length === 20) {
        seatingData = parsed;
        saveToLocalStorage();
        renderGuestLayout();
        renderAdminTableList();
        clearSearch();
        alert("Nhập file cấu hình thành công!");
      } else {
        alert("Định dạng file không đúng. Phải là mảng JSON chứa thông tin 20 mâm.");
      }
    } catch (err) {
      alert("Lỗi khi đọc file JSON: " + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = ""; // Reset file input
}

// 6. QR CODE GENERATORS
let activeQrUrl = "";

function showQrModal(title, subtitle, url) {
  activeQrUrl = url;
  document.getElementById('qr-modal-title').textContent = title;
  document.getElementById('qr-modal-subtitle').textContent = subtitle;
  document.getElementById('qr-url-text').textContent = url;

  // Make sure QRious is loaded
  if (typeof QRious !== 'undefined') {
    new QRious({
      element: document.getElementById('qr-canvas'),
      value: url,
      size: 250,
      background: 'white',
      foreground: '#0c0f1d',
      level: 'H' // High correction level
    });
    document.getElementById('qr-modal').classList.add('active');
  } else {
    alert("Thư viện QRious chưa được tải xong. Vui lòng thử lại sau vài giây.");
  }
}

function closeQrModal(e) {
  if (e === null || e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close')) {
    document.getElementById('qr-modal').classList.remove('active');
  }
}

function generateGeneralQr() {
  saveAppUrl();
  showQrModal(
    "Mã QR Chung",
    "Quét mã QR này để truy cập trang web tra cứu sơ đồ mâm cỗ",
    appBaseUrl
  );
}

function generateTableQr(tableNum) {
  saveAppUrl();
  const url = `${appBaseUrl}?table=${tableNum}`;
  showQrModal(
    `Mã QR Mâm ${tableNum}`,
    `Quét mã này để xem vị trí và những ai ngồi cùng Mâm ${tableNum}`,
    url
  );
}

function generateDelegateQr(delegateName, tableNum, seatId) {
  saveAppUrl();
  // Encode parameter for name
  const encodedName = encodeURIComponent(delegateName);
  const url = `${appBaseUrl}?name=${encodedName}`;
  showQrModal(
    `Mã QR Đại biểu`,
    `Tên: ${delegateName} (Mâm ${tableNum} - Ghế ${seatId})`,
    url
  );
}

function downloadQrCode() {
  const canvas = document.getElementById('qr-canvas');
  const imgUrl = canvas.toDataURL("image/png");
  
  const downloadAnchor = document.createElement('a');
  downloadAnchor.href = imgUrl;
  
  const title = document.getElementById('qr-modal-title').textContent;
  const fileName = title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') + "-qr.png";
  
  downloadAnchor.download = fileName;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function printQrCode() {
  window.print();
}

// 7. DELEGATE VIEW ON LOAD ROUTER (?name=Nguyen+Van+A or ?table=5)
function checkUrlParameters() {
  const params = new URLSearchParams(window.location.search);
  const nameParam = params.get('name');
  const tableParam = params.get('table');

  if (nameParam) {
    // Search delegate by exact or contains match
    const targetName = decodeURIComponent(nameParam).trim();
    let found = null;
    
    for (let t = 0; t < 20; t++) {
      for (let s = 0; s < 8; s++) {
        if (seatingData[t].seats[s].name.toLowerCase() === targetName.toLowerCase()) {
          found = {
            name: seatingData[t].seats[s].name,
            tableNumber: seatingData[t].tableNumber,
            seatId: seatingData[t].seats[s].id,
            tIndex: t,
            sIndex: s
          };
          break;
        }
      }
      if (found) break;
    }
    
    // If exact not found, do partial match
    if (!found) {
      for (let t = 0; t < 20; t++) {
        for (let s = 0; s < 8; s++) {
          if (seatingData[t].seats[s].name.toLowerCase().includes(targetName.toLowerCase())) {
            found = {
              name: seatingData[t].seats[s].name,
              tableNumber: seatingData[t].tableNumber,
              seatId: seatingData[t].seats[s].id,
              tIndex: t,
              sIndex: s
            };
            break;
          }
        }
        if (found) break;
      }
    }

    if (found) {
      selectDelegate(found);
      // Automatically zoom into their table after a brief delay
      setTimeout(() => {
        focusAssignedSeat();
      }, 900);
    }
  } else if (tableParam) {
    const tNum = parseInt(tableParam);
    if (tNum >= 1 && tNum <= 20) {
      // Switch view and open modal
      switchTab('guest');
      setTimeout(() => {
        openTableModal(tNum - 1);
        const targetNode = document.getElementById(`table-${tNum}`);
        if (targetNode) {
          targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
    }
  }
}

// Tab Switching logic
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  if (tabName === 'guest') {
    document.getElementById('tab-guest').classList.add('active');
    document.getElementById('view-guest').classList.add('active');
    renderGuestLayout();
  } else {
    document.getElementById('tab-admin').classList.add('active');
    document.getElementById('view-admin').classList.add('active');
    renderAdminTableList();
  }
}

// 8. ON APP LOAD
window.addEventListener('DOMContentLoaded', () => {
  initDefaultData();
  renderGuestLayout();
  checkUrlParameters();
});
