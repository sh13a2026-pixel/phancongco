// BANQUET SEATING APP LOGIC

// 1. STATE MANAGEMENT
let seatingData = []; // Array of 20 tables, each having an array of 8 seat objects: { id: 1..8, name: "" }
let appBaseUrl = "";
let selectedDelegate = null; // { name, tableIndex, seatIndex }
let layoutConfig = { colsPc: 3, colsMobile: 3 };
let firebaseColsRef = null;
let unassignedDelegates = []; // Array of names: ["Nguyễn Văn A", "Trần Thị B"]
let firebasePoolRef = null;

// CẤU HÌNH KẾT NỐI REALTIME (FIREBASE)
// Sau khi tạo dự án Firebase Realtime Database miễn phí, hãy dán cấu hình của bạn vào đây:
const firebaseConfig = {
  apiKey: "AIzaSyC1hx8QBcXe1fjqAI2XAvsDwuY66ApYnBU",
  authDomain: "letuyenthee1412026.firebaseapp.com",
  databaseURL: "https://letuyenthee1412026-default-rtdb.asia-southeast1.firebasedatabase.app", // Mặc định Singapore. Nếu bạn chọn US hãy đổi thành: https://letuyenthee1412026-default-rtdb.firebaseio.com
  projectId: "letuyenthee1412026",
  storageBucket: "letuyenthee1412026.firebasestorage.app",
  messagingSenderId: "974536000757",
  appId: "1:974536000757:web:33ca407548b658a8b771bc",
  measurementId: "G-8C607MWGFT"
};

let firebaseDbRef = null;
let isFirebaseActive = false;

// Hàm tìm đại biểu theo tên
function findDelegateByName(name) {
  let found = null;
  seatingData.forEach((table, tIndex) => {
    table.seats.forEach((seat, sIndex) => {
      if (seat.name.toLowerCase() === name.toLowerCase()) {
        found = {
          name: seat.name,
          tableNumber: table.tableNumber,
          seatId: seat.id,
          tIndex,
          sIndex
        };
      }
    });
  });
  return found;
}

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
  return str.toLowerCase().trim();
}

// Initialize default data (Tải đồng bộ từ data.json nếu có, nếu không dùng localStorage)
async function initDefaultData() {
  // Bắt buộc sử dụng cấu hình 3 cột để khớp hoàn toàn với sơ đồ mâm cỗ dạng cột trong PDF
  layoutConfig = { colsPc: 3, colsMobile: 3 };
  applyLayoutCols(3, 3);

  // Load unassigned delegates pool từ localStorage trước
  const localPool = localStorage.getItem('banquet_unassigned_pool');
  if (localPool) {
    try {
      unassignedDelegates = JSON.parse(localPool);
    } catch (e) {
      unassignedDelegates = [];
    }
  }

  // Kích hoạt kết nối Firebase Realtime nếu được cấu hình
  if (firebaseConfig.databaseURL && typeof firebase !== 'undefined') {
    try {
      firebase.initializeApp(firebaseConfig);
      firebaseDbRef = firebase.database().ref('seating_data');
      firebaseColsRef = firebase.database().ref('layout_config');
      firebasePoolRef = firebase.database().ref('unassigned_delegates');
      isFirebaseActive = true;
      console.log("Đã kết nối thành công tới Firebase Realtime Database.");
      
      // Lắng nghe danh sách chờ thời gian thực
      firebasePoolRef.on('value', (snapshot) => {
        const val = snapshot.val();
        if (val && Array.isArray(val)) {
          unassignedDelegates = val;
        } else {
          unassignedDelegates = [];
        }
        localStorage.setItem('banquet_unassigned_pool', JSON.stringify(unassignedDelegates));
        updatePoolUI();
      });

      // Lắng nghe cấu hình cột thời gian thực
      firebaseColsRef.on('value', (snapshot) => {
        const val = snapshot.val();
        if (val && (val.colsPc !== 3 || val.colsMobile !== 3)) {
          firebaseColsRef.set({ colsPc: 3, colsMobile: 3 });
        }
        layoutConfig = { colsPc: 3, colsMobile: 3 };
        localStorage.setItem('banquet_layout_config', JSON.stringify(layoutConfig));
        applyLayoutCols(3, 3);
      });
      
      // Lắng nghe sự kiện thay đổi dữ liệu thời gian thực
      firebaseDbRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data && Array.isArray(data) && data.length === 20) {
          seatingData = data;
          localStorage.setItem('banquet_seating_data', JSON.stringify(seatingData));
          
          renderGuestLayout();
          updateStats();
          
          // Vẽ lại đường dẫn định vị nếu đang có khách được chọn
          if (selectedDelegate) {
            const found = findDelegateByName(selectedDelegate.name);
            if (found) {
              selectedDelegate = found;
              drawRoutingPath(found.tableNumber);
            } else {
              clearSearch();
            }
          }
        }
      });

      // Load nhanh cache local trước khi Firebase trả kết quả
      const localData = localStorage.getItem('banquet_seating_data');
      if (localData) {
        seatingData = JSON.parse(localData);
      } else {
        generateEmptyData();
      }
    } catch (err) {
      console.error("Lỗi kết nối Firebase Realtime Database. Chuyển sang dự phòng:", err);
      isFirebaseActive = false;
    }
  }

  if (!isFirebaseActive) {
    let loadedData = null;
    try {
      const response = await fetch('data.json?t=' + new Date().getTime());
      if (response.ok) {
        const remoteData = await response.json();
        if (Array.isArray(remoteData) && remoteData.length === 20) {
          loadedData = remoteData;
          console.log("Đã tải dữ liệu mâm cỗ đồng bộ từ data.json");
        }
      }
    } catch (e) {
      console.log("Không tìm thấy data.json hoặc chưa chạy trên máy chủ, sử dụng dữ liệu localStorage cục bộ.");
    }

    if (loadedData) {
      seatingData = loadedData;
      localStorage.setItem('banquet_seating_data', JSON.stringify(seatingData));
    } else {
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
    }
  }

  // App URL setup
  const savedUrl = localStorage.getItem('banquet_app_url');
  if (savedUrl) {
    appBaseUrl = savedUrl;
  } else {
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
  // Ghi đè trực tiếp lên Firebase Realtime Database nếu kích hoạt
  if (isFirebaseActive && firebaseDbRef) {
    firebaseDbRef.set(seatingData);
  }
}

function syncDataToFirebase() {
  if (isFirebaseActive && firebaseDbRef) {
    Promise.all([
      firebaseDbRef.set(seatingData),
      firebaseColsRef ? firebaseColsRef.set(layoutConfig) : Promise.resolve()
    ])
      .then(() => {
        alert("Đã đồng bộ lên mạng thành công! Từ bây giờ tất cả thiết bị khác quét mã QR sẽ thấy sơ đồ mâm cỗ và cấu hình hiển thị mới ngay lập tức mà không cần tải lại trang.");
      })
      .catch((error) => {
        console.error("Lỗi đồng bộ Firebase:", error);
        alert("Lỗi kết nối Firebase: Không có quyền ghi dữ liệu. Bạn đã sửa Rules trên Firebase chưa? Hãy kiểm tra bảng điều khiển lỗi của trình duyệt (F12) để biết chi tiết.");
      });
  } else {
    alert("Firebase chưa được kích hoạt thành công trên trang này. Vui lòng kiểm tra cấu hình firebaseConfig ở đầu tệp app.js.");
  }
}

function saveAppUrl() {
  const urlInput = document.getElementById('app-base-url').value.trim();
  appBaseUrl = urlInput || (window.location.origin + window.location.pathname.replace(/\/$/, ""));
  localStorage.setItem('banquet_app_url', appBaseUrl);
}

function applyLayoutCols(colsPc, colsMobile) {
  const root = document.documentElement;
  root.style.setProperty('--cols-desktop', colsPc);
  root.style.setProperty('--cols-mobile', colsMobile);

  const pcSelect = document.getElementById('cols-pc-select');
  const mobileSelect = document.getElementById('cols-mobile-select');
  if (pcSelect) pcSelect.value = colsPc;
  if (mobileSelect) mobileSelect.value = colsMobile;

  // Redraw routing path if a delegate is selected
  if (selectedDelegate) {
    drawRoutingPath(selectedDelegate.tableNumber);
  }
}

function updateLayoutCols() {
  const pcSelect = document.getElementById('cols-pc-select');
  const mobileSelect = document.getElementById('cols-mobile-select');
  if (!pcSelect || !mobileSelect) return;

  const colsPc = parseInt(pcSelect.value);
  const colsMobile = parseInt(mobileSelect.value);

  layoutConfig = { colsPc, colsMobile };
  localStorage.setItem('banquet_layout_config', JSON.stringify(layoutConfig));
  applyLayoutCols(colsPc, colsMobile);

  if (isFirebaseActive && firebaseColsRef) {
    firebaseColsRef.set(layoutConfig).catch(err => {
      print(err); // Or console.error
    });
  }
}

function isNamesDisplayEnabled() {
  const checkbox = document.getElementById('toggle-names-checkbox');
  if (checkbox) return checkbox.checked;
  
  const saved = localStorage.getItem('banquet_show_names');
  if (saved !== null) return saved === 'true';
  
  return window.innerWidth > 768;
}

function toggleNamesDisplay(show) {
  localStorage.setItem('banquet_show_names', show);
  
  document.querySelectorAll('.table-names-list').forEach(list => {
    list.style.display = show ? 'flex' : 'none';
  });

  const checkbox = document.getElementById('toggle-names-checkbox');
  if (checkbox) checkbox.checked = show;

  if (selectedDelegate) {
    setTimeout(() => {
      drawRoutingPath(selectedDelegate.tableNumber);
    }, 150);
  }
}

// 2. RENDERING VIEWS
function renderGuestLayout() {
  const container = document.getElementById('tables-container');
  container.innerHTML = "";

  const layoutMap = [3, 2, 1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, null];
  layoutMap.forEach(tableNum => {
    if (tableNum === null) {
      const spacer = document.createElement('div');
      spacer.className = 'table-node-placeholder';
      container.appendChild(spacer);
      return;
    }

    const tIndex = seatingData.findIndex(t => t.tableNumber === tableNum);
    if (tIndex === -1) return;
    const table = seatingData[tIndex];
    const occupiedCount = table.seats.filter(s => s.name.trim() !== "").length;
    
    // Tạo phần tử bọc ngoài (Wrapper)
    const wrapper = document.createElement('div');
    wrapper.className = 'table-node-wrapper';
    wrapper.id = `table-wrapper-${table.tableNumber}`;

    // Tạo mâm cỗ (Circle node)
    const tableNode = document.createElement('div');
    tableNode.className = 'table-node';
    tableNode.id = `table-${table.tableNumber}`;
    tableNode.onclick = () => openTableModal(tIndex);

    // Vẽ text mâm và số lượng
    tableNode.innerHTML = `
      <span class="table-num">Mâm ${table.tableNumber}</span>
      <span class="table-count">${occupiedCount}/8</span>
    `;

    // Vẽ 8 ghế mini xung quanh mâm cỗ
    const seatsIndicator = document.createElement('div');
    seatsIndicator.className = 'mini-seats-indicator';
    
    for (let s = 0; s < 8; s++) {
      const angle = (s * 45 - 90) * (Math.PI / 180);
      const radius = 52; // Tỷ lệ khoảng cách
      const x = 50 + radius * Math.cos(angle);
      const y = 50 + radius * Math.sin(angle);
      
      const seatPill = document.createElement('div');
      seatPill.className = 'mini-seat';
      
      const isOccupied = table.seats[s].name.trim() !== "";
      if (isOccupied) {
        seatPill.classList.add('occupied');
      }
      
      seatPill.id = `mini-seat-${table.tableNumber}-${s + 1}`;
      seatPill.style.left = `${x}%`;
      seatPill.style.top = `${y}%`;
      
      seatsIndicator.appendChild(seatPill);
    }
    
    tableNode.appendChild(seatsIndicator);
    wrapper.appendChild(tableNode);

    // Vẽ danh sách tên đại biểu hiển thị trực quan ngay dưới mâm cỗ
    const namesList = document.createElement('div');
    namesList.className = 'table-names-list';
    namesList.style.display = isNamesDisplayEnabled() ? 'flex' : 'none';

    const occupiedSeats = table.seats.filter(s => s.name.trim() !== "");
    if (occupiedSeats.length > 0) {
      occupiedSeats.forEach(seat => {
        const isTarget = selectedDelegate && 
                         selectedDelegate.tableNumber === table.tableNumber && 
                         selectedDelegate.seatId === seat.id;
        
        const nameItem = document.createElement('div');
        nameItem.className = `name-item ${isTarget ? 'highlighted-name' : ''}`;
        nameItem.textContent = seat.name;
        namesList.appendChild(nameItem);
      });
    } else {
      const emptyItem = document.createElement('div');
      emptyItem.className = 'name-item empty';
      emptyItem.textContent = 'Mâm trống';
      namesList.appendChild(emptyItem);
    }

    wrapper.appendChild(namesList);
    container.appendChild(wrapper);
  });
}

function renderAdminTableList() {
  const container = document.getElementById('admin-tables-container');
  container.innerHTML = "";

  const layoutMap = [3, 2, 1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, null];
  layoutMap.forEach(tableNum => {
    if (tableNum === null) {
      const spacer = document.createElement('div');
      spacer.className = 'table-node-placeholder';
      container.appendChild(spacer);
      return;
    }

    const tIndex = seatingData.findIndex(t => t.tableNumber === tableNum);
    if (tIndex === -1) return;
    const table = seatingData[tIndex];
    const occupiedCount = table.seats.filter(s => s.name.trim() !== "").length;
    
    // Tạo phần tử bọc ngoài (Wrapper)
    const wrapper = document.createElement('div');
    wrapper.className = 'table-node-wrapper';
    wrapper.id = `admin-table-wrapper-${table.tableNumber}`;

    // Tạo mâm cỗ (Circle node)
    const tableNode = document.createElement('div');
    tableNode.className = 'table-node';
    tableNode.id = `admin-table-${table.tableNumber}`;
    tableNode.onclick = () => openAdminEditModal(tIndex);

    // Vẽ text mâm và số lượng
    tableNode.innerHTML = `
      <span class="table-num">Mâm ${table.tableNumber}</span>
      <span class="table-count">${occupiedCount}/8</span>
    `;

    // Vẽ 8 ghế mini xung quanh mâm cỗ
    const seatsIndicator = document.createElement('div');
    seatsIndicator.className = 'mini-seats-indicator';
    
    for (let s = 0; s < 8; s++) {
      const angle = (s * 45 - 90) * (Math.PI / 180);
      const radius = 52; // Tỷ lệ khoảng cách
      const x = 50 + radius * Math.cos(angle);
      const y = 50 + radius * Math.sin(angle);
      
      const seatPill = document.createElement('div');
      seatPill.className = 'mini-seat';
      
      const isOccupied = table.seats[s].name.trim() !== "";
      if (isOccupied) {
        seatPill.classList.add('occupied');
      }
      
      seatPill.id = `admin-mini-seat-${table.tableNumber}-${s + 1}`;
      seatPill.style.left = `${x}%`;
      seatPill.style.top = `${y}%`;
      
      seatsIndicator.appendChild(seatPill);
    }
    
    tableNode.appendChild(seatsIndicator);
    wrapper.appendChild(tableNode);

    // Nút in nhanh QR mâm
    const qrBtn = document.createElement('button');
    qrBtn.className = 'btn btn-secondary';
    qrBtn.style.padding = '5px 10px';
    qrBtn.style.fontSize = '0.75rem';
    qrBtn.style.width = '100%';
    qrBtn.style.marginTop = '8px';
    qrBtn.innerHTML = `<i class="fa-solid fa-qrcode"></i> Mã QR Mâm`;
    qrBtn.onclick = (e) => {
      e.stopPropagation(); // Ngăn mở modal cấu hình
      generateTableQr(table.tableNumber);
    };
    wrapper.appendChild(qrBtn);

    // Vẽ danh sách tên đại biểu hiển thị trực quan ngay dưới mâm cỗ
    const namesList = document.createElement('div');
    namesList.className = 'table-names-list';
    namesList.style.display = isNamesDisplayEnabled() ? 'flex' : 'none';

    const occupiedSeats = table.seats.filter(s => s.name.trim() !== "");
    if (occupiedSeats.length > 0) {
      occupiedSeats.forEach(seat => {
        const nameItem = document.createElement('div');
        nameItem.className = 'name-item';
        nameItem.textContent = seat.name;
        namesList.appendChild(nameItem);
      });
    } else {
      const emptyItem = document.createElement('div');
      emptyItem.className = 'name-item empty';
      emptyItem.textContent = 'Mâm trống';
      namesList.appendChild(emptyItem);
    }

    wrapper.appendChild(namesList);
    container.appendChild(wrapper);
  });
}

function updateSeatName(tIndex, sIndex, name) {
  const oldName = seatingData[tIndex].seats[sIndex].name.trim();
  const newName = name.trim();

  // Nếu tên cũ không trống và thay đổi, đưa tên cũ về bể chờ xếp chỗ
  if (oldName !== "" && oldName !== newName) {
    if (!unassignedDelegates.includes(oldName)) {
      unassignedDelegates.push(oldName);
      localStorage.setItem('banquet_unassigned_pool', JSON.stringify(unassignedDelegates));
      if (isFirebaseActive && firebasePoolRef) {
        firebasePoolRef.set(unassignedDelegates);
      }
      updatePoolUI();
    }
  }

  // Nếu gõ tay trùng với tên có sẵn trong bể chờ xếp chỗ, xóa tên đó khỏi bể
  if (newName !== "" && unassignedDelegates.includes(newName)) {
    unassignedDelegates = unassignedDelegates.filter(n => n !== newName);
    localStorage.setItem('banquet_unassigned_pool', JSON.stringify(unassignedDelegates));
    if (isFirebaseActive && firebasePoolRef) {
      firebasePoolRef.set(unassignedDelegates);
    }
    updatePoolUI();
  }

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
function onSearchFocus() {
  const input = document.getElementById('search-input');
  if (input.value.trim() === "") {
    showAllDelegatesDropdown();
  }
}

function toggleFullList(event) {
  event.stopPropagation();
  const resultsDropdown = document.getElementById('search-results');
  const icon = document.getElementById('dropdown-icon');
  
  if (resultsDropdown.style.display === 'block') {
    resultsDropdown.style.display = 'none';
    icon.className = "fa-solid fa-chevron-down";
  } else {
    showAllDelegatesDropdown();
    icon.className = "fa-solid fa-chevron-up";
  }
}

function showAllDelegatesDropdown() {
  const resultsDropdown = document.getElementById('search-results');
  const list = [];
  
  seatingData.forEach((table, tIndex) => {
    table.seats.forEach((seat, sIndex) => {
      if (seat.name.trim() !== "") {
        list.push({
          name: seat.name,
          tableNumber: table.tableNumber,
          seatId: seat.id,
          tIndex,
          sIndex
        });
      }
    });
  });

  // Sắp xếp bảng chữ cái tiếng Việt
  list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  if (list.length === 0) {
    resultsDropdown.innerHTML = `<div class="result-item" style="color: var(--text-secondary); cursor: default;">Chưa xếp đại biểu nào</div>`;
    resultsDropdown.style.display = 'block';
    return;
  }

  resultsDropdown.innerHTML = "";
  list.forEach(match => {
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <span>${match.name}</span>
      <span class="table-badge">Mâm ${match.tableNumber} - Ghế ${match.seatId}</span>
    `;
    item.onclick = () => {
      selectDelegate(match);
      const icon = document.getElementById('dropdown-icon');
      if (icon) icon.className = "fa-solid fa-chevron-down";
    };
    resultsDropdown.appendChild(item);
  });
  resultsDropdown.style.display = 'block';
}

// Đóng dropdown khi click ra ngoài
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('search-results');
  const inputContainer = document.querySelector('.search-box-container');
  if (dropdown && inputContainer && !inputContainer.contains(e.target)) {
    dropdown.style.display = 'none';
    const icon = document.getElementById('dropdown-icon');
    if (icon) icon.className = "fa-solid fa-chevron-down";
  }
});

function onSearchInput() {
  const query = removeVietnameseTones(document.getElementById('search-input').value);
  const resultsDropdown = document.getElementById('search-results');
  const icon = document.getElementById('dropdown-icon');
  
  if (icon) icon.className = "fa-solid fa-chevron-down";

  if (!query) {
    showAllDelegatesDropdown();
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

  // Vẽ đường dẫn định vị lối đi
  drawRoutingPath(delegate.tableNumber);
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

  // Xóa đường dẫn định vị
  clearRoutingPath();
}

// Logic vẽ đường đi định vị
function drawRoutingPath(tableNum) {
  const svg = document.getElementById('routing-path-svg');
  const table = document.getElementById(`table-${tableNum}`);
  const entrance = document.getElementById('entrance-node');

  if (!svg || !table || !entrance) return;

  // Đợi trình duyệt render xong vị trí
  requestAnimationFrame(() => {
    const svgRect = svg.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const entranceRect = entrance.getBoundingClientRect();

    // Điểm đến: Tâm của bàn ăn mâm cỗ (tọa độ tương đối trong SVG)
    const tx = tableRect.left - svgRect.left + tableRect.width / 2;
    const ty = tableRect.top - svgRect.top + tableRect.height / 2;

    // Điểm đi: Phía trên lối vào chính
    const ex = entranceRect.left - svgRect.left + entranceRect.width / 2;
    const ey = entranceRect.top - svgRect.top;

    // Điểm uốn cong ở giữa cho đẹp mắt
    const cx = (ex + tx) / 2 + (tx > ex ? -60 : 60);
    const cy = (ey + ty) / 2;

    const pathData = `M ${ex} ${ey} Q ${cx} ${cy} ${tx} ${ty}`;
    
    // Đưa đường vẽ động vào SVG
    svg.innerHTML = `<path d="${pathData}" />`;
  });
}

function clearRoutingPath() {
  const svg = document.getElementById('routing-path-svg');
  if (svg) svg.innerHTML = "";
}

// Tự động vẽ lại đường đi khi co giãn trình duyệt
window.addEventListener('resize', () => {
  if (selectedDelegate) {
    drawRoutingPath(selectedDelegate.tableNumber);
  }
});

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

// Tab Switching logic with password protection
let nextTabAfterLogin = "";

function switchTab(tabName) {
  if (tabName === 'admin') {
    // Show login modal instead of switching immediately
    nextTabAfterLogin = 'admin';
    document.getElementById('admin-password-input').value = "";
    document.getElementById('login-error-msg').style.display = 'none';
    document.getElementById('admin-login-modal').classList.add('active');
    // Đợi modal mở ra rồi mới focus
    setTimeout(() => {
      document.getElementById('admin-password-input').focus();
    }, 100);
    return;
  }
  
  executeTabSwitch(tabName);
}

function executeTabSwitch(tabName) {
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

function submitAdminPassword() {
  const pwd = document.getElementById('admin-password-input').value;
  if (pwd === '111996') {
    document.getElementById('admin-login-modal').classList.remove('active');
    executeTabSwitch(nextTabAfterLogin);
  } else {
    document.getElementById('login-error-msg').style.display = 'block';
  }
}

function closeAdminLoginModal(e) {
  if (e === null || e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close')) {
    document.getElementById('admin-login-modal').classList.remove('active');
  }
}

// 9. UNASSIGNED DELEGATE POOL FUNCTIONS
function updatePoolUI() {
  const textarea = document.getElementById('pool-names-input');
  const countSpan = document.getElementById('pool-count');
  if (countSpan) {
    countSpan.textContent = unassignedDelegates.length;
  }
  if (textarea && document.activeElement !== textarea) {
    textarea.value = unassignedDelegates.join('\n');
  }
}

function saveDelegatePool() {
  const textarea = document.getElementById('pool-names-input');
  if (!textarea) return;

  const names = textarea.value.split('\n')
                              .map(name => name.trim())
                              .filter(name => name.length > 0);

  unassignedDelegates = names;
  localStorage.setItem('banquet_unassigned_pool', JSON.stringify(unassignedDelegates));

  if (isFirebaseActive && firebasePoolRef) {
    firebasePoolRef.set(unassignedDelegates)
      .then(() => {
        alert("Đã lưu và đồng bộ danh sách chờ lên mạng!");
      })
      .catch(err => {
        console.error("Lỗi đồng bộ danh sách chờ:", err);
        alert("Lỗi kết nối Firebase khi đồng bộ danh sách chờ.");
      });
  } else {
    alert("Đã lưu danh sách chờ cục bộ thiết bị.");
  }
  updatePoolUI();
}

function showPoolDropdown(input, tIndex, sIndex) {
  document.querySelectorAll('.pool-dropdown').forEach(d => d.style.display = 'none');

  const seatBox = input.parentNode;
  let dropdown = seatBox.querySelector('.pool-dropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.className = 'pool-dropdown';
    dropdown.id = `pool-dropdown-${tIndex}-${sIndex}`;
    seatBox.appendChild(dropdown);
  }

  renderPoolDropdownItems(dropdown, input.value, tIndex, sIndex);
  dropdown.style.display = 'block';
}

function hidePoolDropdown(tIndex, sIndex) {
  const dropdown = document.getElementById(`pool-dropdown-${tIndex}-${sIndex}`);
  if (dropdown) {
    dropdown.style.display = 'none';
  }
}

function filterPoolDropdown(val, tIndex, sIndex) {
  const dropdown = document.getElementById(`pool-dropdown-${tIndex}-${sIndex}`);
  if (dropdown) {
    renderPoolDropdownItems(dropdown, val, tIndex, sIndex);
  }
}

function renderPoolDropdownItems(dropdown, filterVal, tIndex, sIndex) {
  dropdown.innerHTML = "";
  const query = removeVietnameseTones(filterVal);

  const filtered = unassignedDelegates.filter(name => {
    if (!query) return true;
    return removeVietnameseTones(name).includes(query);
  });

  if (filtered.length === 0) {
    dropdown.innerHTML = `<div class="pool-dropdown-item no-match">Không có ai trong danh sách chờ</div>`;
    return;
  }

  filtered.forEach(name => {
    const item = document.createElement('div');
    item.className = 'pool-dropdown-item';
    item.textContent = name;
    item.onmousedown = (e) => {
      e.preventDefault();
      assignFromPool(name, tIndex, sIndex);
    };
    dropdown.appendChild(item);
  });
}

function assignFromPool(name, tIndex, sIndex) {
  const oldName = seatingData[tIndex].seats[sIndex].name.trim();

  // Xóa tên vừa chọn khỏi bể chờ
  unassignedDelegates = unassignedDelegates.filter(n => n !== name);

  // Đưa tên cũ ở ghế này trở lại bể chờ (nếu có)
  if (oldName !== "") {
    unassignedDelegates.push(oldName);
  }

  // Cập nhật ghế
  seatingData[tIndex].seats[sIndex].name = name;

  localStorage.setItem('banquet_seating_data', JSON.stringify(seatingData));
  localStorage.setItem('banquet_unassigned_pool', JSON.stringify(unassignedDelegates));

  if (isFirebaseActive) {
    if (firebaseDbRef) firebaseDbRef.set(seatingData);
    if (firebasePoolRef) firebasePoolRef.set(unassignedDelegates);
  }

  renderGuestLayout();
  renderAdminTableList();
  updateStats();
  updatePoolUI();
}

// 10. VISUAL EDIT MODAL FOR ADMIN
let adminActiveTableIndex = null;
let adminActiveSeatIndex = 0;

function openAdminEditModal(tIndex) {
  adminActiveTableIndex = tIndex;
  adminActiveSeatIndex = 0; // Mặc định chọn ghế đầu tiên (Ghế 1)

  const table = seatingData[tIndex];
  document.getElementById('admin-edit-table-title').textContent = `CẤU HÌNH MÂM SỐ ${table.tableNumber}`;
  document.getElementById('admin-edit-center-label').textContent = `MÂM ${table.tableNumber}`;

  renderAdminEditSeatsRing();
  selectAdminEditSeat(0);

  document.getElementById('admin-edit-modal').classList.add('active');
}

function renderAdminEditSeatsRing() {
  if (adminActiveTableIndex === null) return;
  const table = seatingData[adminActiveTableIndex];
  const ring = document.getElementById('admin-edit-seats-ring');
  ring.innerHTML = "";

  for (let i = 0; i < 8; i++) {
    const seat = table.seats[i];
    const angle = (i * 45 - 90) * (Math.PI / 180);
    const radius = 125;
    const x = 160 + radius * Math.cos(angle);
    const y = 160 + radius * Math.sin(angle);

    const seatNode = document.createElement('div');
    seatNode.className = 'seat-node';
    seatNode.style.left = `${x}px`;
    seatNode.style.top = `${y}px`;

    if (i === adminActiveSeatIndex) {
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

    seatNode.onclick = () => selectAdminEditSeat(i);
    ring.appendChild(seatNode);
  }
}

function selectAdminEditSeat(sIndex) {
  adminActiveSeatIndex = sIndex;
  
  // Highlight ghế đang chọn trên vòng tròn
  const ring = document.getElementById('admin-edit-seats-ring');
  const seatNodes = ring.querySelectorAll('.seat-node');
  seatNodes.forEach((node, idx) => {
    if (idx === sIndex) {
      node.classList.add('active-target');
    } else {
      node.classList.remove('active-target');
    }
  });

  const table = seatingData[adminActiveTableIndex];
  const seat = table.seats[sIndex];

  document.getElementById('admin-selected-seat-label').textContent = `Ghế ${seat.id}`;
  
  const input = document.getElementById('admin-edit-seat-input');
  input.value = seat.name;

  // Ràng buộc nút in QR cho ghế đang chọn
  const qrBtn = document.getElementById('admin-edit-seat-qr-btn');
  if (seat.name.trim() !== "") {
    qrBtn.disabled = false;
    qrBtn.onclick = () => generateDelegateQr(seat.name, table.tableNumber, seat.id);
    qrBtn.style.opacity = '1';
  } else {
    qrBtn.disabled = true;
    qrBtn.onclick = null;
    qrBtn.style.opacity = '0.5';
  }

  // Setup input key listeners & pool dropdown cho ô nhập trong modal này
  input.onfocus = () => showAdminEditPoolDropdown(input);
  input.onblur = () => setTimeout(() => hideAdminEditPoolDropdown(), 250);
  input.onkeyup = (e) => {
    filterAdminEditPoolDropdown(e.target.value);
    updateAdminEditSeatName(e.target.value);
  };
}

function updateAdminEditSeatName(name) {
  if (adminActiveTableIndex === null) return;
  const oldName = seatingData[adminActiveTableIndex].seats[adminActiveSeatIndex].name.trim();
  const newName = name.trim();

  // Trả tên cũ về bể danh sách chờ
  if (oldName !== "" && oldName !== newName) {
    if (!unassignedDelegates.includes(oldName)) {
      unassignedDelegates.push(oldName);
      localStorage.setItem('banquet_unassigned_pool', JSON.stringify(unassignedDelegates));
      if (isFirebaseActive && firebasePoolRef) {
        firebasePoolRef.set(unassignedDelegates);
      }
      updatePoolUI();
    }
  }

  // Xóa khỏi bể danh sách chờ nếu gõ tay khớp
  if (newName !== "" && unassignedDelegates.includes(newName)) {
    unassignedDelegates = unassignedDelegates.filter(n => n !== newName);
    localStorage.setItem('banquet_unassigned_pool', JSON.stringify(unassignedDelegates));
    if (isFirebaseActive && firebasePoolRef) {
      firebasePoolRef.set(unassignedDelegates);
    }
    updatePoolUI();
  }

  seatingData[adminActiveTableIndex].seats[adminActiveSeatIndex].name = name;
  saveToLocalStorage();

  // Cập nhật nhãn tên trực tiếp trên ghế của modal
  const ring = document.getElementById('admin-edit-seats-ring');
  const seatNode = ring.children[adminActiveSeatIndex];
  if (seatNode) {
    const seatId = adminActiveSeatIndex + 1;
    if (newName === "") {
      seatNode.classList.add('empty');
      seatNode.innerHTML = `
        <span class="seat-num">${seatId}</span>
        <span class="seat-name">Trống</span>
      `;
    } else {
      seatNode.classList.remove('empty');
      seatNode.innerHTML = `
        <span class="seat-num">${seatId}</span>
        <span class="seat-name">${newName}</span>
      `;
    }
  }

  // Cập nhật lại các sơ đồ và bảng thống kê
  renderGuestLayout();
  renderAdminTableList();
  updateStats();
}

function clearCurrentAdminSeat() {
  const input = document.getElementById('admin-edit-seat-input');
  input.value = "";
  updateAdminEditSeatName("");
  selectAdminEditSeat(adminActiveSeatIndex);
}

function closeAdminEditModal(e) {
  if (e === null || e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close')) {
    document.getElementById('admin-edit-modal').classList.remove('active');
    adminActiveTableIndex = null;
  }
}

// Trợ giúp bể chờ trên Modal
function showAdminEditPoolDropdown(input) {
  const dropdown = document.getElementById('admin-edit-pool-dropdown');
  if (!dropdown) return;
  renderAdminEditPoolDropdownItems(dropdown, input.value);
  dropdown.style.display = 'block';
}

function hideAdminEditPoolDropdown() {
  const dropdown = document.getElementById('admin-edit-pool-dropdown');
  if (dropdown) dropdown.style.display = 'none';
}

function filterAdminEditPoolDropdown(val) {
  const dropdown = document.getElementById('admin-edit-pool-dropdown');
  if (dropdown) renderAdminEditPoolDropdownItems(dropdown, val);
}

function renderAdminEditPoolDropdownItems(dropdown, filterVal) {
  dropdown.innerHTML = "";
  const query = removeVietnameseTones(filterVal);

  const filtered = unassignedDelegates.filter(name => {
    if (!query) return true;
    return removeVietnameseTones(name).includes(query);
  });

  if (filtered.length === 0) {
    dropdown.innerHTML = `<div class="pool-dropdown-item no-match">Không có ai trong danh sách chờ</div>`;
    return;
  }

  filtered.forEach(name => {
    const item = document.createElement('div');
    item.className = 'pool-dropdown-item';
    item.textContent = name;
    item.onmousedown = (e) => {
      e.preventDefault();
      assignFromAdminPool(name);
    };
    dropdown.appendChild(item);
  });
}

function assignFromAdminPool(name) {
  const input = document.getElementById('admin-edit-seat-input');
  input.value = name;
  updateAdminEditSeatName(name);
  selectAdminEditSeat(adminActiveSeatIndex);
}

// 8. ON APP LOAD
window.addEventListener('DOMContentLoaded', async () => {
  await initDefaultData();
  const checkbox = document.getElementById('toggle-names-checkbox');
  if (checkbox) checkbox.checked = isNamesDisplayEnabled();
  renderGuestLayout();
  updatePoolUI();
  checkUrlParameters();
});
