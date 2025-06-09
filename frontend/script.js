// Основні URL для API
const API_BASE_URL = 'http://localhost:8080';

// DOM елементи
const flightSearchForm = document.getElementById('flightSearchForm');
const departureSelect = document.getElementById('departure');
const arrivalSelect = document.getElementById('arrival');
const searchResults = document.getElementById('searchResults');
const checkinResults = document.getElementById('checkinResults');

// Завантаження аеропортів при завантаженні сторінки
document.addEventListener('DOMContentLoaded', async () => {
    await loadAirports();
});

// Завантаження списку аеропортів
async function loadAirports() {
    try {
        const response = await fetch(`${API_BASE_URL}/airports`);
        const airports = await response.json();
        
        // Очищаємо та заповнюємо випадаючі списки
        departureSelect.innerHTML = '';
        arrivalSelect.innerHTML = '';
        
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '-- Оберіть аеропорт --';
        departureSelect.appendChild(defaultOption.cloneNode(true));
        arrivalSelect.appendChild(defaultOption.cloneNode(true));
        
        airports.forEach(airport => {
            const option = document.createElement('option');
            option.value = airport.id;
            option.textContent = `${airport.city} (${airport.code})`;
            departureSelect.appendChild(option.cloneNode(true));
            arrivalSelect.appendChild(option.cloneNode(true));
        });
    } catch (error) {
        console.error('Помилка завантаження аеропортів:', error);
        showError(searchResults, 'Не вдалося завантажити список аеропортів');
    }
}

// Обробник пошуку рейсів
flightSearchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const departureId = departureSelect.value;
    const arrivalId = arrivalSelect.value;
    const date = document.getElementById('departureDate').value;
    
    if (!departureId || !arrivalId || !date) {
        showError(searchResults, 'Будь ласка, заповніть всі поля');
        return;
    }
    
    try {
        
        // Показуємо заглушку з прикладом рейсу
        searchResults.innerHTML = `
            <div class="flight-card">
                <h3>Рейс KBP → LHR</h3>
                <p>Дата: ${formatDate(date)}</p>
                <p>Час вильоту: 08:00</p>
                <p>Час прибуття: 10:30</p>
                <p>Літак: Boeing 737</p>
                <button onclick="showBookingForm(1)">Забронювати</button>
            </div>
        `;
    } catch (error) {
        console.error('Помилка пошуку рейсів:', error);
        showError(searchResults, 'Не вдалося знайти рейси');
    }
});

// Показати форму бронювання
function showBookingForm(flightId) {
    searchResults.innerHTML += `
        <div id="bookingForm" class="flight-card">
            <h3>Бронювання рейсу</h3>
            <form id="passengerForm">
                <div class="form-group">
                    <label for="passengerName">ПІБ</label>
                    <input type="text" id="passengerName" required>
                </div>
                <div class="form-group">
                    <label for="passengerEmail">Email</label>
                    <input type="email" id="passengerEmail" required>
                </div>
                <div class="form-group">
                    <label for="seatNumber">Місце</label>
                    <input type="text" id="seatNumber" placeholder="Наприклад, 12A" required>
                </div>
                <input type="hidden" id="flightId" value="${flightId}">
                <button type="submit">Забронювати</button>
            </form>
        </div>
    `;
    
    document.getElementById('passengerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await bookFlight();
    });
}

// Бронювання рейсу
async function bookFlight() {
    const passengerName = document.getElementById('passengerName').value;
    const passengerEmail = document.getElementById('passengerEmail').value;
    const seatNumber = document.getElementById('seatNumber').value;
    const flightId = document.getElementById('flightId').value;
    
    try {
        const response = await fetch(API_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `passenger_name=${encodeURIComponent(passengerName)}&email=${encodeURIComponent(passengerEmail)}&flight_id=${flightId}&seat=${encodeURIComponent(seatNumber)}`
        });
        
        if (response.ok) {
            const result = await response.text();
            showSuccess(searchResults, 'Бронювання успішне!');
            
            // Показу кнопку для онлайн-реєстрації
            checkinResults.innerHTML = `
                <div class="flight-card">
                    <h3>Онлайн-реєстрація</h3>
                    <p>Ви можете пройти онлайн-реєстрацію на ваш рейс</p>
                    <button onclick="showBoardingPass('${passengerName}', '${flightId}', '${seatNumber}')">Отримати посадочний талон</button>
                </div>
            `;
        } else {
            throw new Error('Помилка бронювання');
        }
    } catch (error) {
        console.error('Помилка бронювання:', error);
        showError(searchResults, 'Не вдалося забронювати рейс');
    }
}

// Показати посадочний талон
function showBoardingPass(passengerName, flightId, seatNumber) {
    checkinResults.innerHTML = `
        <div class="flight-card">
            <h3>Посадочний талон</h3>
            <div class="boarding-pass">
                <p><strong>Пасажир:</strong> ${passengerName}</p>
                <p><strong>Рейс:</strong> ${flightId}</p>
                <p><strong>Місце:</strong> ${seatNumber}</p>
                <p><strong>Дата:</strong> ${formatDate(document.getElementById('departureDate').value)}</p>
                <p><strong>Час посадки:</strong> 07:30</p>
                <p><strong>Термінал:</strong> A</p>
                <p><strong>Вихід:</strong> B12</p>
            </div>
            <button onclick="printBoardingPass()">Друк талону</button>
        </div>
    `;
}

// Друк посадочного талону
function printBoardingPass() {
    window.print();
}


function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('uk-UA', options);
}

function showError(container, message) {
    container.innerHTML = `<div class="error-message">${message}</div>`;
}

function showSuccess(container, message) {
    container.innerHTML = `<div class="success-message">${message}</div>`;
}