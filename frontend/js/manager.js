// Global Variables
let menuItems = [];
let staffs = [];
let tables = [];
let orders = [];
let currentOrderId = null;
let currentOrderDetail = null;
let orderDetailModal = null;
let ordersOffset = 0;
let ordersLimit = 10;
let addMenuItemModal = null;
let addStaffModal = null;
let revenueChart = null;
let reportChart = null;

// API Endpoints
const API_BASE_URL = 'http://localhost:8000';
const ORDERS_URL = `${API_BASE_URL}/orders/`;
const MENU_URL = `${API_BASE_URL}/menu/`;
const STAFFS_URL = `${API_BASE_URL}/staffs/`;
const TABLES_URL = `${API_BASE_URL}/tables/`;

// Initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Setup menu toggle functionality
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    
    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('sidebar-collapsed');
            mainContent.classList.toggle('main-content-expanded');
        });
    }
    
    // Setup tab switching
    const navLinks = document.querySelectorAll('.nav-links li');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            if (tabId) {
                switchTab(tabId);
            }
        });
    });
    
    // Setup logout functionality
    const logoutBtn = document.getElementById('logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // Initialize date and time display
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Initialize modals
    orderDetailModal = new bootstrap.Modal(document.getElementById('orderDetailModal'));
    addMenuItemModal = new bootstrap.Modal(document.getElementById('addMenuItemModal'));
    addStaffModal = new bootstrap.Modal(document.getElementById('addStaffModal'));
    
    // Initialize data
    fetchMenuItems();
    fetchStaffs();
    fetchTables();
    fetchRecentOrders();
    updateDashboardStats();
    
    // Initialize charts if in dashboard
    if (document.getElementById('revenue-chart')) {
        initializeRevenueChart();
    }
    
    // Display user name from token
    displayUserInfo();
});

// Display user information from token
function displayUserInfo() {
    try {
        const token = localStorage.getItem('access_token');
        if (token) {
            const tokenParts = token.split('.');
            if (tokenParts.length === 3) {
                const payload = JSON.parse(atob(tokenParts[1]));
                if (payload.name) {
                    document.getElementById('user-name').textContent = payload.name;
                }
            }
        }
    } catch (error) {
        console.error("Error parsing token:", error);
    }
}

// Update date and time display
function updateDateTime() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    document.getElementById('date-time').textContent = now.toLocaleDateString('vi-VN', options);
}

// Switch between tabs
function switchTab(tabId) {
    // Update active tab in sidebar
    document.querySelectorAll('.nav-links li').forEach(item => {
        item.classList.remove('active');
    });
    
    const activeTab = document.querySelector(`.nav-links li[data-tab="${tabId}"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    // Update content section
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    const activeContent = document.getElementById(`${tabId}-content`);
    if (activeContent) {
        activeContent.classList.add('active');
        
        // Load data based on active tab
        if (tabId === 'dashboard') {
            updateDashboardStats();
            fetchRecentOrders();
        } else if (tabId === 'orders') {
            ordersOffset = 0;
            fetchOrders(false);
        } else if (tabId === 'menu') {
            fetchMenuItems();
        } else if (tabId === 'staffs') {
            fetchStaffs();
        } else if (tabId === 'tables') {
            fetchTables();
        } else if (tabId === 'reports') {
            // Initialize report chart if needed
            if (!reportChart && document.getElementById('report-chart')) {
                initializeReportChart();
            }
        }
    }
}

// Fetch menu items from API
async function fetchMenuItems() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(MENU_URL, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to fetch menu items');
        }
        
        menuItems = await response.json();
        console.log('Menu items:', menuItems);
        
        // Update menu items UI
        updateMenuItemsUI();
        
        // Update dashboard UI
        document.getElementById('total-menu-items').textContent = menuItems.length;
        
        // Update popular items
        updatePopularItems();
    } catch (error) {
        console.error('Error fetching menu items:', error);
        showAlert('Error fetching menu items', 'danger');
    }
}

// Update menu items UI
function updateMenuItemsUI() {
    const menuTableBody = document.getElementById('menu-table-body');
    if (!menuTableBody) return;
    
    menuTableBody.innerHTML = '';
    
    menuItems.forEach(item => {
        const row = document.createElement('tr');
        
        const statusBadge = item.is_available ? 
            '<span class="badge bg-success">Có sẵn</span>' : 
            '<span class="badge bg-danger">Hết hàng</span>';
        
        row.innerHTML = `
            <td>${item.id}</td>
            <td>
                <img src="${MENU_URL}${item.img_path || 'https://via.placeholder.com/50'}" 
                    alt="${item.name}" width="50" height="50" class="rounded">
            </td>
            <td>${item.name}</td>
            <td>${formatCurrency(item.price)}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editMenuItem(${item.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-${item.is_available ? 'warning' : 'success'}" 
                    onclick="toggleMenuItemAvailability(${item.id}, ${!item.is_available})">
                    <i class="fas fa-${item.is_available ? 'times' : 'check'}"></i>
                </button>
            </td>
        `;
        
        menuTableBody.appendChild(row);
    });
}

// Update popular items list
function updatePopularItems() {
    const popularItemsList = document.getElementById('popular-items');
    if (!popularItemsList) return;
    
    // For now, just display the first 5 menu items
    // In a real app, this would be sorted by popularity
    popularItemsList.innerHTML = '';
    
    menuItems.slice(0, 5).forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="item-name">
                <img class="item-img" src="${MENU_URL}${item.img_path || 'https://via.placeholder.com/40'}" alt="${item.name}">
                <span>${item.name}</span>
            </div>
            <div class="item-price">${formatCurrency(item.price)}</div>
        `;
        popularItemsList.appendChild(li);
    });
}

// Fetch staffs from API
async function fetchStaffs() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(STAFFS_URL, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to fetch staffs');
        }
        
        staffs = await response.json();
        console.log('Staffs:', staffs);
        
        // Update staffs UI
        updateStaffsUI();
        
        // Update dashboard UI
        document.getElementById('total-staffs').textContent = staffs.length;
    } catch (error) {
        console.error('Error fetching staffs:', error);
        showAlert('Error fetching staffs', 'danger');
    }
}

// Update staffs UI
function updateStaffsUI() {
    const staffsTableBody = document.getElementById('staffs-table-body');
    if (!staffsTableBody) return;
    
    staffsTableBody.innerHTML = '';
    
    staffs.forEach(staff => {
        const row = document.createElement('tr');
        
        let roleText = 'Chưa xác định';
        let roleClass = 'secondary';
        
        if (staff.role === 'manager') {
            roleText = 'Quản lý';
            roleClass = 'primary';
        } else if (staff.role === 'waiter') {
            roleText = 'Nhân viên phục vụ';
            roleClass = 'success';
        } else if (staff.role === 'chef') {
            roleText = 'Đầu bếp';
            roleClass = 'warning';
        }
        
        row.innerHTML = `
            <td>${staff.id}</td>
            <td>${staff.name}</td>
            <td><span class="badge bg-${roleClass}">${roleText}</span></td>
            <td>${staff.username}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editStaff(${staff.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteStaff(${staff.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        staffsTableBody.appendChild(row);
    });
}

// Fetch tables from API
async function fetchTables() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(TABLES_URL, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to fetch tables');
        }
        
        tables = await response.json();
        console.log('Tables:', tables);
        
        // Update tables UI
        updateTablesUI();
        updateTableStatusUI();
    } catch (error) {
        console.error('Error fetching tables:', error);
        showAlert('Error fetching tables', 'danger');
    }
}

// Update tables UI
function updateTablesUI() {
    const tablesGrid = document.getElementById('tables-grid');
    if (!tablesGrid) return;
    
    tablesGrid.innerHTML = '';
    
    tables.forEach(table => {
        const tableCard = document.createElement('div');
        tableCard.className = `table-card ${table.is_available ? 'table-available' : 'table-occupied'}`;
        
        tableCard.innerHTML = `
            <div class="table-number">Bàn ${table.id}</div>
            <div class="table-status-text">${table.is_available ? 'Trống' : 'Có khách'}</div>
            <div class="table-actions">
                <button class="btn btn-sm btn-outline-${table.is_available ? 'success' : 'warning'}" 
                    onclick="toggleTableAvailability(${table.id}, ${!table.is_available})">
                    ${table.is_available ? 'Đặt bàn' : 'Giải phóng'}
                </button>
            </div>
        `;
        
        tablesGrid.appendChild(tableCard);
    });
}

// Update table status UI on dashboard
function updateTableStatusUI() {
    const tableStatus = document.getElementById('table-status');
    if (!tableStatus) return;
    
    tableStatus.innerHTML = '';
    
    // Show only the first 8 tables on dashboard
    tables.slice(0, 8).forEach(table => {
        const tableCard = document.createElement('div');
        tableCard.className = `table-card ${table.is_available ? 'table-available' : 'table-occupied'}`;
        
        tableCard.innerHTML = `
            <div class="table-number">Bàn ${table.id}</div>
            <div class="table-status-text">${table.is_available ? 'Trống' : 'Có khách'}</div>
        `;
        
        tableStatus.appendChild(tableCard);
    });
}

// Fetch orders with pagination
async function fetchOrders(append = true) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${ORDERS_URL}?offset=${ordersOffset}&limit=${ordersLimit}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to fetch orders');
        }
        
        const newOrders = await response.json();
        
        if (append) {
            orders = [...orders, ...newOrders];
        } else {
            orders = newOrders;
        }
        
        console.log('Orders:', orders);
        
        // Update orders UI
        updateOrdersUI();
        
        // Show/hide load more button
        const loadMoreBtn = document.getElementById('load-more-orders');
        if (loadMoreBtn) {
            loadMoreBtn.style.display = newOrders.length < ordersLimit ? 'none' : 'block';
        }
    } catch (error) {
        console.error('Error fetching orders:', error);
        showAlert('Error fetching orders', 'danger');
    }
}

// Update orders UI
function updateOrdersUI() {
    const ordersTableBody = document.getElementById('orders-table-body');
    if (!ordersTableBody) return;
    
    // Get filter values
    const statusFilter = document.getElementById('order-status-filter')?.value || 'all';
    
    // Filter orders based on status
    let filteredOrders = orders;
    if (statusFilter !== 'all') {
        filteredOrders = orders.filter(order => order.status === statusFilter);
    }
    
    // Sort orders by creation time (newest first)
    filteredOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    ordersTableBody.innerHTML = '';
    
    filteredOrders.forEach(order => {
        const row = document.createElement('tr');
        
        let statusBadge = '';
        if (order.status === 'opening') {
            statusBadge = '<span class="badge bg-success">Đang mở</span>';
        } else if (order.status === 'closed') {
            statusBadge = '<span class="badge bg-secondary">Đã đóng</span>';
        } else if (order.status === 'canceled') {
            statusBadge = '<span class="badge bg-danger">Đã hủy</span>';
        }
        
        row.innerHTML = `
            <td>${order.id}</td>
            <td>${order.table_id}</td>
            <td>${order.server_id}</td>
            <td>${formatCurrency(order.total_amount)}</td>
            <td>${statusBadge} ${order.is_paid ? '<span class="badge bg-info">Đã thanh toán</span>' : ''}</td>
            <td>${formatDateTime(order.created_at)}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="viewOrderDetail(${order.id})">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline-${order.status === 'opening' ? 'success' : 'secondary'}" 
                    onclick="toggleOrderStatus(${order.id}, '${order.status === 'opening' ? 'closed' : 'opening'}')">
                    <i class="fas fa-${order.status === 'opening' ? 'check' : 'undo'}"></i>
                </button>
            </td>
        `;
        
        ordersTableBody.appendChild(row);
    });
}

// Load more orders
function loadMoreOrders() {
    ordersOffset += ordersLimit;
    fetchOrders(true);
}

// Filter orders by status
function filterOrdersByStatus() {
    updateOrdersUI();
}

// Filter orders by date
function filterOrdersByDate() {
    const dateFilter = document.getElementById('order-date-filter')?.value;
    if (!dateFilter) {
        updateOrdersUI();
        return;
    }
    
    fetchOrdersByDate(dateFilter);
}

// Fetch orders by date
async function fetchOrdersByDate(date) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${ORDERS_URL}by-date/${date}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to fetch orders by date');
        }
        
        orders = await response.json();
        updateOrdersUI();
    } catch (error) {
        console.error('Error fetching orders by date:', error);
        showAlert('Error fetching orders by date', 'danger');
    }
}

// Fetch recent orders for dashboard
async function fetchRecentOrders() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${ORDERS_URL}?limit=5`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to fetch recent orders');
        }
        
        const recentOrders = await response.json();
        
        // Update recent orders list
        updateRecentOrdersUI(recentOrders);
    } catch (error) {
        console.error('Error fetching recent orders:', error);
    }
}

// Update recent orders UI on dashboard
function updateRecentOrdersUI(recentOrders) {
    const recentOrdersList = document.getElementById('recent-orders');
    if (!recentOrdersList) return;
    
    recentOrdersList.innerHTML = '';
    
    if (recentOrders.length === 0) {
        recentOrdersList.innerHTML = '<li class="text-center text-muted py-3">Không có đơn hàng gần đây</li>';
        return;
    }
    
    recentOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    recentOrders.forEach(order => {
        const li = document.createElement('li');
        
        li.innerHTML = `
            <div class="order-info">
                <span class="order-id">Đơn #${order.id}</span>
                <span class="order-time">${formatDateTime(order.created_at, true)}</span>
            </div>
            <div class="order-detail">
                <span class="order-table">Bàn ${order.table_id}</span>
                <span class="order-amount">${formatCurrency(order.total_amount)}</span>
            </div>
        `;
        
        li.addEventListener('click', () => viewOrderDetail(order.id));
        recentOrdersList.appendChild(li);
    });
}

// View order detail
async function viewOrderDetail(orderId) {
    try {
        currentOrderId = orderId;
        
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${ORDERS_URL}${orderId}/`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to fetch order detail');
        }
        
        currentOrderDetail = await response.json();
        console.log('Order detail:', currentOrderDetail);
        
        // Update order detail UI
        updateOrderDetailUI();
        
        // Show modal
        orderDetailModal.show();
    } catch (error) {
        console.error('Error fetching order detail:', error);
        showAlert('Error fetching order detail', 'danger');
    }
}

// Update order detail UI
function updateOrderDetailUI() {
    if (!currentOrderDetail) return;
    
    const orderDetailContent = document.getElementById('order-detail-content');
    const detailOrderId = document.getElementById('detail-order-id');
    const markPaidBtn = document.getElementById('mark-paid-btn');
    
    detailOrderId.textContent = currentOrderDetail.id;
    
    // Set text for mark paid button
    if (markPaidBtn) {
        markPaidBtn.textContent = currentOrderDetail.is_paid ? 'Đánh dấu chưa thanh toán' : 'Đánh dấu đã thanh toán';
    }
    
    // Format order items
    let orderItemsHtml = '';
    let totalAmount = 0;
    
    currentOrderDetail.order_items.forEach(item => {
        const menuItem = menuItems.find(m => m.id === item.item_id) || { name: `Món #${item.item_id}`, price: 0 };
        const itemTotal = parseFloat(menuItem.price) * item.quantity;
        totalAmount += itemTotal;
        
        let statusBadge = '';
        if (item.status === 'pending') {
            statusBadge = '<span class="badge bg-warning">Chờ xử lý</span>';
        } else if (item.status === 'received') {
            statusBadge = '<span class="badge bg-info">Đang chế biến</span>';
        } else if (item.status === 'completed') {
            statusBadge = '<span class="badge bg-success">Hoàn thành</span>';
        } else if (item.status === 'canceled') {
            statusBadge = '<span class="badge bg-danger">Đã hủy</span>';
        }
        
        orderItemsHtml += `
            <tr>
                <td>${menuItem.name}</td>
                <td>${item.quantity}</td>
                <td>${formatCurrency(menuItem.price)}</td>
                <td>${formatCurrency(itemTotal)}</td>
                <td>${item.note || ''}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    });
    
    // Format order detail
    orderDetailContent.innerHTML = `
        <div class="row mb-4">
            <div class="col-md-6">
                <p><strong>Bàn:</strong> ${currentOrderDetail.table_id}</p>
                <p><strong>Người phục vụ:</strong> #${currentOrderDetail.server_id}</p>
                <p><strong>Trạng thái:</strong> 
                    <span class="badge ${currentOrderDetail.status === 'opening' ? 'bg-success' : 
                        currentOrderDetail.status === 'closed' ? 'bg-secondary' : 'bg-danger'}">
                        ${currentOrderDetail.status === 'opening' ? 'Đang mở' : 
                        currentOrderDetail.status === 'closed' ? 'Đã đóng' : 'Đã hủy'}
                    </span>
                    ${currentOrderDetail.is_paid ? '<span class="badge bg-info">Đã thanh toán</span>' : ''}
                </p>
            </div>
            <div class="col-md-6">
                <p><strong>Mã đơn:</strong> #${currentOrderDetail.id}</p>
                <p><strong>Thời gian tạo:</strong> ${formatDateTime(currentOrderDetail.created_at)}</p>
                <p><strong>Thời gian đóng:</strong> ${currentOrderDetail.closed_at ? formatDateTime(currentOrderDetail.closed_at) : 'Chưa đóng'}</p>
            </div>
        </div>
        
        <div class="table-responsive">
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>Món ăn</th>
                        <th>Số lượng</th>
                        <th>Đơn giá</th>
                        <th>Thành tiền</th>
                        <th>Ghi chú</th>
                        <th>Trạng thái</th>
                    </tr>
                </thead>
                <tbody>
                    ${orderItemsHtml}
                </tbody>
                <tfoot>
                    <tr>
                        <th colspan="3" class="text-end">Tổng cộng:</th>
                        <th colspan="3">${formatCurrency(totalAmount)}</th>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
}

// Toggle order paid status
async function togglePaidStatus() {
    if (!currentOrderDetail) return;
    
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${ORDERS_URL}${currentOrderDetail.id}/`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                is_paid: !currentOrderDetail.is_paid,
                status: currentOrderDetail.status // Keep current status
            })
        });
        
        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to update order paid status');
        }
        
        // Update current order detail
        currentOrderDetail.is_paid = !currentOrderDetail.is_paid;
        
        // Update UI
        updateOrderDetailUI();
        
        // Show success message
        showAlert(`Đơn hàng đã được đánh dấu ${currentOrderDetail.is_paid ? 'đã' : 'chưa'} thanh toán`, 'success');
        
        // Refresh orders list
        fetchOrders(false);
        fetchRecentOrders();
    } catch (error) {
        console.error('Error updating order paid status:', error);
        showAlert('Error updating order paid status', 'danger');
    }
}

// Toggle order status
async function toggleOrderStatus(orderId, newStatus) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${ORDERS_URL}${orderId}/`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to update order status');
        }
        
        // Show success message
        showAlert(`Trạng thái đơn hàng đã được cập nhật thành ${newStatus === 'opening' ? 'đang mở' : 'đã đóng'}`, 'success');
        
        // Refresh orders list
        fetchOrders(false);
        fetchRecentOrders();
    } catch (error) {
        console.error('Error updating order status:', error);
        showAlert('Error updating order status', 'danger');
    }
}

// Print invoice
function printInvoice() {
    if (!currentOrderDetail) return;
    
    // Create a new window with invoice content
    const printWindow = window.open('', '_blank');
    
    // Format order items for printing
    let orderItemsHtml = '';
    let totalAmount = 0;
    
    currentOrderDetail.order_items.forEach(item => {
        const menuItem = menuItems.find(m => m.id === item.item_id) || { name: `Món #${item.item_id}`, price: 0 };
        const itemTotal = parseFloat(menuItem.price) * item.quantity;
        totalAmount += itemTotal;
        
        orderItemsHtml += `
            <tr>
                <td>${menuItem.name}</td>
                <td style="text-align: center;">${item.quantity}</td>
                <td style="text-align: right;">${formatCurrency(menuItem.price)}</td>
                <td style="text-align: right;">${formatCurrency(itemTotal)}</td>
            </tr>
        `;
    });
    
    // Generate invoice HTML
    const invoiceHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Hóa đơn #${currentOrderDetail.id}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                }
                
                .invoice-header {
                    text-align: center;
                    margin-bottom: 20px;
                }
                
                .invoice-header h1 {
                    margin: 0;
                    color: #4A6FA5;
                }
                
                .invoice-details {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 30px;
                }
                
                .invoice-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 30px;
                }
                
                .invoice-table th, .invoice-table td {
                    border: 1px solid #ddd;
                    padding: 8px;
                }
                
                .invoice-table th {
                    background-color: #f5f7fa;
                }
                
                .invoice-total {
                    text-align: right;
                    margin-bottom: 30px;
                }
                
                .invoice-note {
                    border-top: 1px solid #ddd;
                    padding-top: 20px;
                    text-align: center;
                }
                
                @media print {
                    body {
                        padding: 0;
                    }
                    
                    .no-print {
                        display: none;
                    }
                }
            </style>
        </head>
        <body>
            <div class="invoice-header">
                <h1>HÓA ĐƠN THANH TOÁN</h1>
                <p>Nhà hàng của chúng tôi</p>
            </div>
            
            <div class="invoice-details">
                <div>
                    <p><strong>Mã hóa đơn:</strong> #${currentOrderDetail.id}</p>
                    <p><strong>Bàn:</strong> ${currentOrderDetail.table_id}</p>
                    <p><strong>Nhân viên:</strong> #${currentOrderDetail.server_id}</p>
                </div>
                <div>
                    <p><strong>Ngày:</strong> ${formatDate(currentOrderDetail.created_at)}</p>
                    <p><strong>Giờ:</strong> ${formatTime(currentOrderDetail.created_at)}</p>
                    <p><strong>Trạng thái:</strong> ${currentOrderDetail.is_paid ? 'Đã thanh toán' : 'Chưa thanh toán'}</p>
                </div>
            </div>
            
            <table class="invoice-table">
                <thead>
                    <tr>
                        <th>Món ăn</th>
                        <th style="text-align: center;">Số lượng</th>
                        <th style="text-align: right;">Đơn giá</th>
                        <th style="text-align: right;">Thành tiền</th>
                    </tr>
                </thead>
                <tbody>
                    ${orderItemsHtml}
                </tbody>
                <tfoot>
                    <tr>
                        <th colspan="3" style="text-align: right;">Tổng cộng:</th>
                        <th style="text-align: right;">${formatCurrency(totalAmount)}</th>
                    </tr>
                </tfoot>
            </table>
            
            <div class="invoice-total">
                <h3>Tổng thanh toán: ${formatCurrency(totalAmount)}</h3>
            </div>
            
            <div class="invoice-note">
                <p>Cảm ơn quý khách đã sử dụng dịch vụ của chúng tôi!</p>
                <p>Hẹn gặp lại quý khách lần sau.</p>
            </div>
            
            <div class="no-print" style="margin-top: 30px; text-align: center;">
                <button onclick="window.print()" style="padding: 10px 20px;">In hóa đơn</button>
            </div>
        </body>
        </html>
    `;
    
    printWindow.document.write(invoiceHtml);
    printWindow.document.close();
}

// Add new menu item
async function addMenuItem() {
    const name = document.getElementById('menu-name').value;
    const price = document.getElementById('menu-price').value;
    const isAvailable = document.getElementById('menu-available').checked;
    
    if (!name || !price) {
        showAlert('Vui lòng nhập đầy đủ thông tin', 'warning');
        return;
    }
    
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(MENU_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                price: parseFloat(price),
                is_available: isAvailable,
                img_path: 'default.jpg' // For simplicity, use a default image
            })
        });
        
        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to add menu item');
        }
        
        // Hide modal
        addMenuItemModal.hide();
        
        // Clear form
        document.getElementById('add-menu-form').reset();
        
        // Show success message
        showAlert('Thêm món ăn mới thành công', 'success');
        
        // Refresh menu items
        fetchMenuItems();
    } catch (error) {
        console.error('Error adding menu item:', error);
        showAlert('Error adding menu item', 'danger');
    }
}

// Toggle menu item availability
async function toggleMenuItemAvailability(itemId, newAvailability) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${MENU_URL}${itemId}/`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_available: newAvailability })
        });
        
        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to update menu item availability');
        }
        
        // Show success message
        showAlert(`Trạng thái món ăn đã được cập nhật thành ${newAvailability ? 'có sẵn' : 'hết hàng'}`, 'success');
        
        // Refresh menu items
        fetchMenuItems();
    } catch (error) {
        console.error('Error updating menu item availability:', error);
        showAlert('Error updating menu item availability', 'danger');
    }
}

// Add new staff
async function addStaff() {
    const name = document.getElementById('staff-name').value;
    const role = document.getElementById('staff-role').value;
    const username = document.getElementById('staff-username').value;
    const password = document.getElementById('staff-password').value;
    
    if (!name || !role || !username || !password) {
        showAlert('Vui lòng nhập đầy đủ thông tin', 'warning');
        return;
    }
    
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(STAFFS_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                role: role,
                username: username,
                password: password
            })
        });
        
        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to add staff');
        }
        
        // Hide modal
        addStaffModal.hide();
        
        // Clear form
        document.getElementById('add-staff-form').reset();
        
        // Show success message
        showAlert('Thêm nhân viên mới thành công', 'success');
        
        // Refresh staffs
        fetchStaffs();
    } catch (error) {
        console.error('Error adding staff:', error);
        showAlert('Error adding staff', 'danger');
    }
}

// Add new table
async function addNewTable() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(TABLES_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_available: true })
        });
        
        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to add table');
        }
        
        // Show success message
        showAlert('Thêm bàn mới thành công', 'success');
        
        // Refresh tables
        fetchTables();
    } catch (error) {
        console.error('Error adding table:', error);
        showAlert('Error adding table', 'danger');
    }
}

// Toggle table availability
async function toggleTableAvailability(tableId, newAvailability) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${TABLES_URL}${tableId}/`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_available: newAvailability })
        });
        
        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to update table availability');
        }
        
        // Show success message
        showAlert(`Trạng thái bàn đã được cập nhật thành ${newAvailability ? 'trống' : 'có khách'}`, 'success');
        
        // Refresh tables
        fetchTables();
    } catch (error) {
        console.error('Error updating table availability:', error);
        showAlert('Error updating table availability', 'danger');
    }
}

// Update dashboard statistics
async function updateDashboardStats() {
    try {
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${ORDERS_URL}by-date/${today}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to fetch today\'s orders');
        }
        
        const todayOrders = await response.json();
        
        // Calculate total revenue
        let totalRevenue = 0;
        todayOrders.forEach(order => {
            totalRevenue += parseFloat(order.total_amount);
        });
        
        // Update UI
        document.getElementById('total-orders-today').textContent = todayOrders.length;
        document.getElementById('total-revenue-today').textContent = formatCurrency(totalRevenue);
        
        // Update revenue chart if exists
        if (revenueChart) {
            updateRevenueChart(todayOrders);
        }
    } catch (error) {
        console.error('Error updating dashboard stats:', error);
    }
}

// Initialize revenue chart
function initializeRevenueChart() {
    const ctx = document.getElementById('revenue-chart');
    if (!ctx) return;
    
    // Initialize with empty data
    revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
            datasets: [{
                label: 'Doanh thu (VNĐ)',
                data: Array(24).fill(0),
                borderColor: '#4A6FA5',
                backgroundColor: 'rgba(74, 111, 165, 0.1)',
                borderWidth: 2,
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCompactCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

// Update revenue chart with today's orders
function updateRevenueChart(todayOrders) {
    if (!revenueChart) return;
    
    // Group orders by hour
    const revenueByHour = Array(24).fill(0);
    
    todayOrders.forEach(order => {
        const orderTime = new Date(order.created_at);
        const hour = orderTime.getHours();
        revenueByHour[hour] += parseFloat(order.total_amount);
    });
    
    // Update chart data
    revenueChart.data.datasets[0].data = revenueByHour;
    revenueChart.update();
}

// Initialize report chart
function initializeReportChart() {
    const ctx = document.getElementById('report-chart');
    if (!ctx) return;
    
    // Initialize with empty data
    reportChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Không có dữ liệu'],
            datasets: [{
                label: 'Doanh thu',
                data: [0],
                backgroundColor: '#4A6FA5',
                borderColor: '#4A6FA5',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCompactCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

// Change report type
function changeReportType() {
    const reportType = document.getElementById('report-type').value;
    const dateSelector = document.getElementById('date-selector');
    const monthSelector = document.getElementById('month-selector');
    
    if (reportType === 'daily') {
        dateSelector.style.display = 'block';
        monthSelector.style.display = 'none';
    } else {
        dateSelector.style.display = 'none';
        monthSelector.style.display = 'block';
    }
}

// Generate report
async function generateReport() {
    const reportType = document.getElementById('report-type').value;
    
    if (reportType === 'daily') {
        const reportDate = document.getElementById('report-date').value;
        
        if (!reportDate) {
            showAlert('Vui lòng chọn ngày báo cáo', 'warning');
            return;
        }
        
        await generateDailyReport(reportDate);
    } else {
        const reportMonth = document.getElementById('report-month').value;
        
        if (!reportMonth) {
            showAlert('Vui lòng chọn tháng báo cáo', 'warning');
            return;
        }
        
        await generateMonthlyReport(reportMonth);
    }
}

// Generate daily report
async function generateDailyReport(date) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${ORDERS_URL}by-date/${date}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to fetch orders for report');
        }
        
        const orders = await response.json();
        
        // Group orders by hour
        const revenueByHour = Array(24).fill(0);
        const orderCountByHour = Array(24).fill(0);
        
        let totalRevenue = 0;
        let totalOrders = orders.length;
        let completedOrders = 0;
        
        orders.forEach(order => {
            const orderTime = new Date(order.created_at);
            const hour = orderTime.getHours();
            
            revenueByHour[hour] += parseFloat(order.total_amount);
            orderCountByHour[hour]++;
            
            totalRevenue += parseFloat(order.total_amount);
            
            if (order.status === 'closed') {
                completedOrders++;
            }
        });
        
        // Update chart
        if (reportChart) {
            reportChart.data.labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
            reportChart.data.datasets[0].data = revenueByHour;
            reportChart.update();
        }
        
        // Update summary
        const reportSummary = document.getElementById('report-summary');
        
        const formattedDate = new Date(date).toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        reportSummary.innerHTML = `
            <h4 class="text-center mb-4">Báo cáo doanh thu ngày ${formattedDate}</h4>
            <div class="row">
                <div class="col-md-3">
                    <div class="card bg-light">
                        <div class="card-body text-center">
                            <h5>Tổng đơn hàng</h5>
                            <h3>${totalOrders}</h3>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-light">
                        <div class="card-body text-center">
                            <h5>Đơn hoàn thành</h5>
                            <h3>${completedOrders}</h3>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-light">
                        <div class="card-body text-center">
                            <h5>Tỷ lệ hoàn thành</h5>
                            <h3>${totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) + '%' : '0%'}</h3>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-light">
                        <div class="card-body text-center">
                            <h5>Tổng doanh thu</h5>
                            <h3>${formatCurrency(totalRevenue)}</h3>
                        </div>
                    </div>
                </div>
            </div>
            
            <h5 class="mt-4">Giờ cao điểm:</h5>
            <p>Giờ có nhiều đơn nhất: <strong>${findPeakHour(orderCountByHour)}:00</strong> (${Math.max(...orderCountByHour)} đơn)</p>
            <p>Giờ có doanh thu cao nhất: <strong>${findPeakHour(revenueByHour)}:00</strong> (${formatCurrency(Math.max(...revenueByHour))})</p>
        `;
    } catch (error) {
        console.error('Error generating daily report:', error);
        showAlert('Error generating report', 'danger');
    }
}

// Generate monthly report
async function generateMonthlyReport(monthStr) {
    try {
        // Split yyyy-mm into year and month
        const [year, month] = monthStr.split('-');
        
        // Generate array of all days in the month
        const daysInMonth = new Date(year, month, 0).getDate();
        const daysArray = Array.from({ length: daysInMonth }, (_, i) => `${year}-${month}-${String(i + 1).padStart(2, '0')}`);
        
        // Initialize data arrays
        const revenueByDay = Array(daysInMonth).fill(0);
        const orderCountByDay = Array(daysInMonth).fill(0);
        
        let totalRevenue = 0;
        let totalOrders = 0;
        let completedOrders = 0;
        
        // Fetch data for each day
        const token = localStorage.getItem('access_token');
        
        for (let i = 0; i < daysArray.length; i++) {
            const date = daysArray[i];
            
            const response = await fetch(`${ORDERS_URL}by-date/${date}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.status === 401) {
                handleUnauthorized();
                return;
            }
            
            if (!response.ok) continue;
            
            const orders = await response.json();
            
            orders.forEach(order => {
                revenueByDay[i] += parseFloat(order.total_amount);
                orderCountByDay[i]++;
                
                totalRevenue += parseFloat(order.total_amount);
                totalOrders++;
                
                if (order.status === 'closed') {
                    completedOrders++;
                }
            });
        }
        
        // Update chart
        if (reportChart) {
            reportChart.data.labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
            reportChart.data.datasets[0].data = revenueByDay;
            reportChart.update();
        }
        
        // Update summary
        const reportSummary = document.getElementById('report-summary');
        
        const formattedMonth = new Date(year, month - 1).toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: 'long'
        });
        
        reportSummary.innerHTML = `
            <h4 class="text-center mb-4">Báo cáo doanh thu tháng ${formattedMonth}</h4>
            <div class="row">
                <div class="col-md-3">
                    <div class="card bg-light">
                        <div class="card-body text-center">
                            <h5>Tổng đơn hàng</h5>
                            <h3>${totalOrders}</h3>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-light">
                        <div class="card-body text-center">
                            <h5>Đơn hoàn thành</h5>
                            <h3>${completedOrders}</h3>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-light">
                        <div class="card-body text-center">
                            <h5>Tỷ lệ hoàn thành</h5>
                            <h3>${totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) + '%' : '0%'}</h3>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-light">
                        <div class="card-body text-center">
                            <h5>Tổng doanh thu</h5>
                            <h3>${formatCurrency(totalRevenue)}</h3>
                        </div>
                    </div>
                </div>
            </div>
            
            <h5 class="mt-4">Thống kê theo ngày:</h5>
            <p>Ngày có nhiều đơn nhất: <strong>${findPeakDay(orderCountByDay)}</strong> (${Math.max(...orderCountByDay)} đơn)</p>
            <p>Ngày có doanh thu cao nhất: <strong>${findPeakDay(revenueByDay)}</strong> (${formatCurrency(Math.max(...revenueByDay))})</p>
            <p>Doanh thu trung bình mỗi ngày: <strong>${formatCurrency(totalRevenue / daysInMonth)}</strong></p>
        `;
    } catch (error) {
        console.error('Error generating monthly report:', error);
        showAlert('Error generating report', 'danger');
    }
}

// Export report
function exportReport() {
    alert('Tính năng xuất báo cáo sẽ được phát triển trong phiên bản tiếp theo.');
}

// Search menu items
function searchMenuItems() {
    const searchTerm = document.getElementById('menu-search').value.toLowerCase();
    
    if (searchTerm === '') {
        updateMenuItemsUI();
        return;
    }
    
    const filteredItems = menuItems.filter(item => 
        item.name.toLowerCase().includes(searchTerm) || 
        item.id.toString().includes(searchTerm)
    );
    
    const menuTableBody = document.getElementById('menu-table-body');
    if (!menuTableBody) return;
    
    menuTableBody.innerHTML = '';
    
    if (filteredItems.length === 0) {
        menuTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-3">Không tìm thấy món ăn khớp với "${searchTerm}"</td>
            </tr>
        `;
        return;
    }
    
    filteredItems.forEach(item => {
        const row = document.createElement('tr');
        
        const statusBadge = item.is_available ? 
            '<span class="badge bg-success">Có sẵn</span>' : 
            '<span class="badge bg-danger">Hết hàng</span>';
        
        row.innerHTML = `
            <td>${item.id}</td>
            <td>
                <img src="${MENU_URL}${item.img_path || 'https://via.placeholder.com/50'}" 
                    alt="${item.name}" width="50" height="50" class="rounded">
            </td>
            <td>${item.name}</td>
            <td>${formatCurrency(item.price)}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editMenuItem(${item.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-${item.is_available ? 'warning' : 'success'}" 
                    onclick="toggleMenuItemAvailability(${item.id}, ${!item.is_available})">
                    <i class="fas fa-${item.is_available ? 'times' : 'check'}"></i>
                </button>
            </td>
        `;
        
        menuTableBody.appendChild(row);
    });
}

// Helper Functions

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

// Format compact currency (for chart labels)
function formatCompactCurrency(amount) {
    if (amount >= 1000000) {
        return (amount / 1000000).toFixed(1) + 'M';
    } else if (amount >= 1000) {
        return (amount / 1000).toFixed(1) + 'K';
    }
    return amount;
}

// Format date and time
function formatDateTime(dateTimeStr, shortFormat = false) {
    if (!dateTimeStr) return '';
    
    const date = new Date(dateTimeStr);
    
    if (shortFormat) {
        return date.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    return date.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format date only
function formatDate(dateTimeStr) {
    if (!dateTimeStr) return '';
    
    const date = new Date(dateTimeStr);
    
    return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// Format time only
function formatTime(dateTimeStr) {
    if (!dateTimeStr) return '';
    
    const date = new Date(dateTimeStr);
    
    return date.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Find peak hour
function findPeakHour(hourlyData) {
    let maxValue = -1;
    let peakHour = 0;
    
    hourlyData.forEach((value, hour) => {
        if (value > maxValue) {
            maxValue = value;
            peakHour = hour;
        }
    });
    
    return peakHour;
}

// Find peak day
function findPeakDay(dailyData) {
    let maxValue = -1;
    let peakDay = 0;
    
    dailyData.forEach((value, day) => {
        if (value > maxValue) {
            maxValue = value;
            peakDay = day;
        }
    });
    
    return peakDay + 1; // Days are 1-indexed
}

// Show alert message
function showAlert(message, type) {
    // Create alert element
    const alertElement = document.createElement('div');
    alertElement.className = `alert alert-${type} alert-dismissible fade show`;
    alertElement.style.position = 'fixed';
    alertElement.style.top = '20px';
    alertElement.style.right = '20px';
    alertElement.style.zIndex = '9999';
    
    alertElement.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Add to document
    document.body.appendChild(alertElement);
    
    // Remove after 5 seconds
    setTimeout(() => {
        alertElement.remove();
    }, 5000);
}

// Handle unauthorized access
function handleUnauthorized() {
    localStorage.removeItem('access_token');
    sessionStorage.removeItem('role');
    window.location.href = '/login.html?expired=true';
}

// Logout function
function logout() {
    localStorage.removeItem('access_token');
    sessionStorage.removeItem('role');
    window.location.href = '/login.html';
}