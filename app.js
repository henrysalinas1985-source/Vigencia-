import { api } from './API/api.js';

const listElement = document.getElementById('equipment-list');
const addBtn = document.getElementById('add-btn');
const cancelBtn = document.getElementById('cancel-btn');
const modalOverlay = document.getElementById('modal-overlay');
const form = document.getElementById('equipment-form');

// Initial Render
function renderList() {
    const data = api.getData();
    listElement.innerHTML = '';

    if (data.length === 0) {
        listElement.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">No hay datos. Presiona "AGREGAR" o recarga la página.</td></tr>';
        return;
    }

    data.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.aparato}</td>
            <td>${item.equipo || '-'}</td>
            <td>${item.serie}</td>
            <td>${item.ubicacion}</td>
            <td>${item.calibracion || 'Pendiente'}</td>
            <td><span class="badge ${item.vencimiento ? 'badge-warning' : ''}">${item.vencimiento || 'N/A'}</span></td>
            <td>
                <button class="btn-danger delete-btn" data-id="${item.id}">ELIMINAR</button>
            </td>
        `;
        listElement.appendChild(tr);
    });

    // Attach delete events
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = () => {
            const id = parseInt(btn.getAttribute('data-id'));
            if (confirm('¿Estás seguro de eliminar este registro?')) {
                api.deleteItem(id);
                renderList();
            }
        };
    });
}

// Modal Handlers
addBtn.onclick = () => {
    form.reset();
    modalOverlay.style.display = 'flex';
}
cancelBtn.onclick = () => modalOverlay.style.display = 'none';

window.onclick = (e) => {
    if (e.target === modalOverlay) modalOverlay.style.display = 'none';
};

// Form Handler
form.onsubmit = (e) => {
    e.preventDefault();

    const newItem = {
        aparato: document.getElementById('aparato').value,
        equipo: document.getElementById('equipo').value,
        serie: document.getElementById('serie').value,
        ubicacion: document.getElementById('ubicacion').value,
        calibracion: document.getElementById('calibracion').value,
        vencimiento: document.getElementById('vencimiento').value
    };

    api.addItem(newItem);
    modalOverlay.style.display = 'none';
    renderList();
};

// Initial Load
renderList();
