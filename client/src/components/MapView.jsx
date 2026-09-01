import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';

function pinIcon(color, label) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 22px; height: 22px; border-radius: 50% 50% 50% 0;
      background:${color}; transform: rotate(-45deg);
      border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,.35);
      display:flex; align-items:center; justify-content:center;
    "><span style="transform: rotate(45deg); color:#fff; font-weight:800; font-size:11px;">${label}</span></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -20],
  });
}

function totoIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative; width:40px; height:40px;">
      <div style="position:absolute; inset:0; border-radius:50%; background:rgba(14,159,110,.35); animation: pulse 1.4s infinite;"></div>
      <div style="position:absolute; inset:5px; border-radius:50%; background:#fff; border:2px solid #0e9f6e; display:flex; align-items:center; justify-content:center; font-size:19px; box-shadow:0 2px 8px rgba(0,0,0,.25);">🛺</div>
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function ClickCatcher({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick?.(e.latlng);
    },
  });
  return null;
}

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds?.length) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [bounds, map]);
  return null;
}

export default function MapView({ center, pickup, drop, driverPos, onMapClick, bounds, className }) {
  const safeCenter = center || { lat: 25.5348, lng: 87.5734 };
  return (
    <MapContainer
      center={[safeCenter.lat, safeCenter.lng]}
      zoom={13}
      className={className || 'map-fill'}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {onMapClick && <ClickCatcher onMapClick={onMapClick} />}
      {bounds && <FitBounds bounds={bounds} />}
      {pickup && (
        <Marker position={[pickup.lat, pickup.lng]} icon={pinIcon('#0e9f6e', 'P')}>
          <Popup>{pickup.name || 'Pickup'}</Popup>
        </Marker>
      )}
      {drop && (
        <Marker position={[drop.lat, drop.lng]} icon={pinIcon('#e11d48', 'D')}>
          <Popup>{drop.name || 'Drop'}</Popup>
        </Marker>
      )}
      {driverPos && (
        <Marker position={[driverPos.lat, driverPos.lng]} icon={totoIcon()}>
          <Popup>Your toto driver is here</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
