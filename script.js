const map = L.map('map').setView([-7.8, 110.37], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);

// Menggunakan Ikon Custom
const customRsIcon = L.icon({
  iconUrl: 'icon.png', 
  iconSize: [35, 35],
  iconAnchor: [17, 35],
  popupAnchor: [0, -35]
});

// Daftar RS
const rumahSakitList = [
  { name: "RS Ludira Husada Tama", lat: -7.7924902, lng: 110.3529661 },
  { name: "RS Bethesda", lat: -7.783183, lng: 110.3777776 },
  { name: "RS Panti Rapih", lat: -7.7772269, lng: 110.3760914 },
  { name: "RS Bethesda Lempuyangan", lat: -7.7968089, lng: 110.3730405   },
  { name: "RSU PKU Muhammadiyah", lat: -7.8011933, lng: 110.3622428 },
  { name: "RSUD Kota Yogyakarta", lat: -7.8251827, lng: 110.377977 },
  { name: "RSI Hidayatullah", lat: -7.8153508, lng: 110.3877743 },
  { name: "RSKIA PKU Muhammadiyah Kotagede", lat: -7.8228552, lng: 110.4007544 },
  { name: "RS Siloam Yogyakarta", lat: -7.7834618, lng: 110.3907675 },
  { name: "RS Happy Land", lat: -7.7940429, lng: 110.3918092 },
  { name: "RS Pratama", lat: -7.8156616, lng: 110.3739253 }
];

let rsMarkers = []; 

function renderRsMarkers() {
  rsMarkers.forEach(m => map.removeLayer(m));
  rsMarkers = [];
  
  rumahSakitList.forEach(rs => {
    const marker = L.marker([rs.lat, rs.lng], { icon: customRsIcon }).addTo(map);
    
    // Memunculkan nama RS secara permanen
    marker.bindTooltip(rs.name, {
      permanent: true,
      direction: 'top',
      offset: [0, -35],
      className: 'hospital-label'
    });
    
    rsMarkers.push(marker);
  });
}

renderRsMarkers();

let kejadianMarker = null;
let routingControl = null;
let isFetching = false;

// UI Control Functions
const loadingOverlay = document.getElementById("loading-overlay");
function showLoading() { loadingOverlay.classList.remove("hidden"); }
function hideLoading() { loadingOverlay.classList.add("hidden"); }

// --- IMPROVISASI SISTEM TOAST (MULTIPLE & URUT) ---
const oldToast = document.getElementById("toast");
if (oldToast) oldToast.remove(); // Hapus toast HTML bawaan agar tidak bentrok

const toastContainer = document.createElement("div");
toastContainer.style.position = "fixed";
toastContainer.style.zIndex = "4000";
toastContainer.style.display = "flex";
toastContainer.style.flexDirection = "column";
toastContainer.style.gap = "10px";
toastContainer.style.pointerEvents = "none"; // Agar klik map tidak terhalang
document.body.appendChild(toastContainer);

function adjustToastContainer() {
  if (window.innerWidth <= 768) {
    toastContainer.style.bottom = "unset";
    toastContainer.style.top = "20px";
    toastContainer.style.right = "50%";
    toastContainer.style.transform = "translateX(50%)";
    toastContainer.style.width = "90%";
    toastContainer.style.alignItems = "center";
  } else {
    toastContainer.style.top = "unset";
    toastContainer.style.bottom = "30px";
    toastContainer.style.right = "30px";
    toastContainer.style.transform = "none";
    toastContainer.style.width = "auto";
    toastContainer.style.alignItems = "flex-end";
  }
}
adjustToastContainer();
window.addEventListener("resize", adjustToastContainer);

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  // Override posisi agar mengikuti aliran container secara dinamis
  toast.style.position = "relative";
  toast.style.bottom = "unset";
  toast.style.right = "unset";
  toast.style.top = "unset";
  toast.style.transform = "translateY(20px)";
  toast.style.opacity = "0";
  toast.style.transition = "all 0.4s ease";
  if (window.innerWidth <= 768) toast.style.width = "100%";
  
  toast.innerHTML = message;
  toastContainer.appendChild(toast);

  // Animasi Muncul
  setTimeout(() => {
    toast.style.transform = "translateY(0)";
    toast.style.opacity = "1";
  }, 10);

  // Animasi Hilang (Setiap pesan punya timer 4,5 detiknya sendiri)
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-15px)";
    setTimeout(() => {
      toast.remove(); // Bersihkan dari memori setelah animasi selesai
    }, 400); 
  }, 4500); 
}
// --------------------------------------------------

// Event: Reset Peta
document.getElementById('btn-reset').addEventListener('click', () => {
  if (kejadianMarker) map.removeLayer(kejadianMarker);
  if (routingControl) map.removeControl(routingControl);
  kejadianMarker = null;
  routingControl = null;
  
  rsMarkers.forEach(m => m.closePopup());
  map.setView([-7.8, 110.37], 13);
  
  // HANYA INI YANG BIRU ("info")
  showToast("Peta berhasil dibersihkan.", "info");
});

// Event: Deteksi Lokasi
document.getElementById('btn-location').addEventListener('click', () => {
  if (!navigator.geolocation) {
    showToast("Geolokasi tidak didukung oleh browser Anda.", "error");
    return;
  }
  
  showLoading();
  const loadingText = document.querySelector('.loading-text');
  loadingText.innerText = "Mencari sinyal GPS terbaik...";
  
  let watchId;
  let timeoutId;
  let bestPosition = null;
  
  const targetAccuracy = 30; 
  const maxWaitTime = 25000; 

  const finishLocationSearch = (position) => {
    navigator.geolocation.clearWatch(watchId); 
    clearTimeout(timeoutId); 
    
    hideLoading();
    loadingText.innerText = "Mencari rute tercepat..."; 
    
    if (position) {
      const userLatLng = L.latLng(position.coords.latitude, position.coords.longitude);
      const finalAccuracy = Math.round(position.coords.accuracy);
      
      map.setView(userLatLng, 15);
      
      if (finalAccuracy <= 50) {
        showToast(`Lokasi dikunci! (Akurasi: ±${finalAccuracy}m)`, "success");
      } else {
        // UBAH JADI HIJAU JUGA ("success")
        showToast(`Sinyal lemah (Akurasi terbaik: ±${finalAccuracy}m)`, "success");
      }
      
      calculateNearestHospital(userLatLng);
    } else {
      showToast("Gagal mendapatkan lokasi yang valid.", "error");
    }
  };

  timeoutId = setTimeout(() => {
    if (bestPosition) {
      finishLocationSearch(bestPosition); 
    } else {
      finishLocationSearch(null); 
      showToast("Waktu habis. Gagal mengunci sinyal GPS.", "error");
    }
  }, maxWaitTime);

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const currentAccuracy = position.coords.accuracy;
      if (!bestPosition || currentAccuracy < bestPosition.coords.accuracy) {
        bestPosition = position;
      }
      loadingText.innerText = `Menunggu akurasi GPS... (Saat ini: ±${Math.round(currentAccuracy)}m)`;
      if (currentAccuracy <= targetAccuracy) {
        finishLocationSearch(position);
      }
    },
    (error) => {
      let errorMsg = "Gagal mendeteksi lokasi.";
      if (error.code === error.PERMISSION_DENIED) errorMsg = "Akses GPS ditolak oleh browser/sistem.";
      if (error.code === error.POSITION_UNAVAILABLE) errorMsg = "Sinyal GPS tidak tersedia.";
      if (error.code === error.TIMEOUT) errorMsg = "Waktu pencarian GPS habis.";
      
      if (error.code === error.TIMEOUT && bestPosition) {
        finishLocationSearch(bestPosition);
      } else {
        finishLocationSearch(null);
        showToast(errorMsg, "error");
      }
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
  );
});

// Event: Klik Peta Manual
map.on('click', function (e) {
  calculateNearestHospital(e.latlng);
});

// Main Logic: Pencarian Rute
async function calculateNearestHospital(startLatLng) {
  if (isFetching) return; 
  
  isFetching = true;
  showLoading();

  rsMarkers.forEach(m => m.closePopup());

  if (kejadianMarker) map.removeLayer(kejadianMarker);
  if (routingControl) map.removeControl(routingControl);

  kejadianMarker = L.marker(startLatLng, { draggable: true })
    .addTo(map)
    .bindPopup("<strong>Titik Kejadian</strong><br><small><i>(Geser pin jika kurang pas)</i></small>", { 
      autoClose: false 
    })
    .openPopup();

  kejadianMarker.on('dragend', function (event) {
    const posisiBaru = event.target.getLatLng();
    isFetching = false; 
    calculateNearestHospital(posisiBaru);
  });

  const startCoord = `${startLatLng.lng},${startLatLng.lat}`;
  const rsCoords = rumahSakitList.map(rs => `${rs.lng},${rs.lat}`).join(';');
  const allCoords = `${startCoord};${rsCoords}`;
  const destinationIndices = rumahSakitList.map((_, i) => i + 1).join(';');
  
  const tableUrl = `https://router.project-osrm.org/table/v1/driving/${allCoords}?sources=0&destinations=${destinationIndices}&annotations=duration,distance`;

  try {
    const response = await fetch(tableUrl);
    const data = await response.json();

    if (data.code === 'Ok' && data.durations && data.durations[0]) {
      let minDuration = Infinity;
      let bestRsIndex = -1;

      data.durations[0].forEach((duration, index) => {
        if (duration !== null && duration < minDuration) {
          minDuration = duration;
          bestRsIndex = index;
        }
      });

      if (bestRsIndex !== -1) {
        const bestRs = rumahSakitList[bestRsIndex];
        
        const jarakMeter = data.distances[0][bestRsIndex];
        const jarakTeks = jarakMeter >= 1000 
          ? (jarakMeter / 1000).toFixed(1) + ' km'
          : Math.round(jarakMeter) + ' m';

        const estimasiMenit = Math.round(minDuration / 60);

        // Buat Garis Rute (Routing)
        routingControl = L.Routing.control({
          waypoints: [
            startLatLng,
            L.latLng(bestRs.lat, bestRs.lng)
          ],
          router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1'
          }),
          createMarker: function (i, wp) { return null; },
          
          // UBAH BARIS INI: True (muncul) di desktop, False (sembunyi) di mobile
          show: window.innerWidth > 768, 
          
          addWaypoints: false,
          fitSelectedRoutes: true, 
          routeWhileDragging: false
        }).addTo(map);

        // 1. Buat Link Direct ke Google Maps (Format: origin to destination)
        const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${startLatLng.lat},${startLatLng.lng}&destination=${bestRs.lat},${bestRs.lng}&travelmode=driving`;

        // 2. Tambahkan tombol HTML di dalam Popup
        rsMarkers[bestRsIndex].bindPopup(`
          <div style="text-align: center; padding-bottom: 5px;">
            <strong style="font-size: 14px;">${bestRs.name}</strong><br>
            <span style="color: red; font-weight: bold;">Est. Waktu: ${estimasiMenit} Menit</span><br>
            <span style="color: #666; font-size: 13px;">Jarak Rute: ${jarakTeks}</span><br>
            
            <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer" style="
              display: inline-block;
              margin-top: 10px;
              background-color: #4285F4;
              color: white;
              text-decoration: none;
              padding: 6px 12px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: bold;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            ">📍 Buka di Google Maps</a>
          </div>
        `, { 
          autoClose: false 
        }).openPopup();;

        showToast(`Rute tercepat ke: <strong>${bestRs.name}</strong>`, "success");
      } else {
        showToast("Tidak ada rute darat yang ditemukan.", "error");
      }
    } else {
      showToast("Gagal mendapatkan kalkulasi dari server OSRM.", "error");
    }
  } catch (err) {
    console.error("Gagal fetch:", err);
    showToast("Terjadi kesalahan jaringan saat mengambil data rute.", "error");
  } finally {
    hideLoading();
    isFetching = false;
  }
}