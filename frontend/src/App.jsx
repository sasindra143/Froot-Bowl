import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Camera,
  CheckCheck,
  Eye,
  EyeOff,
  ExternalLink,
  Phone,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Dumbbell,
  Heart,
  Instagram,
  LocateFixed,
  Leaf,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Minus,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  Truck,
  UserRound,
  X,
} from "lucide-react";

const WHATSAPP_NUMBER = "919959732476";
const INSTAGRAM_URL = "https://www.instagram.com/froot_bowl_markapur/";
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || "";
let googleMapsPromise;

const markapurAddressSuggestions = [
  "Gandhi Bazar",
  "Vadde Bazar",
  "Peram Bazar",
  "Aravind Ghosh Road",
  "Chakali Bazar",
  "Chenna Kesava Temple Road",
  "Koneru Bazar",
  "Vijaya Lakshmi Veedhi",
  "Radha Krishna Road",
  "Nagulavaram Road",
  "Market Road",
  "Jawahar Nagar Main Road",
  "Shivaji Nagar",
  "Ganesh Nagar",
  "Vidya Nagar",
  "Naidu Street",
  "New Market Lane",
  "Sri Chennakesava Swamy Temple",
  "Sri Ramalayam Temple",
  "Dornala Bus Stand",
  "Cumbum Bus Stand",
  "APSRTC Bus Stand",
  "Vijaya Talkies",
  "Mother India Hospital",
];

const bowlSizes = ["Small", "Regular", "Large"];
const fruitChoices = ["Watermelon", "Pineapple", "Papaya", "Banana", "Apple", "Seasonal fruits"];
const toppingChoices = ["Kiwi", "Dragon fruit", "Pomegranate", "Grapes", "Chia seeds", "Nuts"];

function openWhatsApp(message) {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function mapsDirectionsUrl(latitude, longitude) {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

function mapsSearchUrl(query) {
  const address = `${query}, Markapur, Andhra Pradesh, India`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function phoneLink(phone) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function riderWhatsAppUrl(phone, message) {
  const digits = phone.replace(/\D/g, "");
  const number = digits.length === 10
    ? `91${digits}`
    : digits.length === 11 && digits.startsWith("0")
      ? `91${digits.slice(1)}`
      : digits;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function distanceMeters(first, second) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latDifference = radians(second.latitude - first.latitude);
  const lngDifference = radians(second.longitude - first.longitude);
  const value =
    Math.sin(latDifference / 2) ** 2 +
    Math.cos(radians(first.latitude)) *
      Math.cos(radians(second.latitude)) *
      Math.sin(lngDifference / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)) * 1000;
}

function addressFromMapResult(result) {
  const address = result?.address || {};
  const road = address.road || address.pedestrian || address.footway || address.path || address.cycleway || address.service || address.track || "";
  const area =
    address.neighbourhood ||
    address.suburb ||
    address.quarter ||
    address.village ||
    address.city_district ||
    address.residential ||
    address.hamlet ||
    address.locality ||
    "";
  const rawLine1 =
    [address.house_number, road].filter(Boolean).join(" ") ||
    road ||
    (result?.name !== area ? result?.name : "") ||
    "";
  const line1 = rawLine1 && rawLine1.length < 8 ? `${rawLine1}, ${area}` : rawLine1;
  const landmark =
    (result?.name && result.name !== road && result.name !== line1 ? result.name : "") ||
    address.amenity ||
    address.shop ||
    address.tourism ||
    address.leisure ||
    address.building ||
    "";
  const pincode = String(address.postcode || "").match(/\b\d{6}\b/)?.[0] || "";
  return { line1, area, pincode, landmark };
}

function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve(window.google);
  if (googleMapsPromise) return googleMapsPromise;
  googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&loading=async`;
    script.onload = () => window.google?.maps
      ? resolve(window.google)
      : reject(new Error("Google Maps did not initialize."));
    script.onerror = () => reject(new Error("Google Maps could not load."));
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}

function GoogleTrackingMap({ destination, rider }) {
  const mapElement = useRef(null);
  const mapInstance = useRef(null);
  const riderMarker = useRef(null);
  const [mapStatus, setMapStatus] = useState(GOOGLE_MAPS_API_KEY ? "loading" : "unconfigured");

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return undefined;
    let active = true;
    loadGoogleMaps()
      .then((google) => {
        if (!active || !mapElement.current) return;
        const map = new google.maps.Map(mapElement.current, {
          center: { lat: destination.latitude, lng: destination.longitude },
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        mapInstance.current = map;
        new google.maps.Marker({
          map,
          position: { lat: destination.latitude, lng: destination.longitude },
          title: "Customer delivery location",
          label: "D",
        });
        setMapStatus("ready");
      })
      .catch(() => {
        if (active) setMapStatus("error");
      });
    return () => {
      active = false;
      mapInstance.current = null;
      riderMarker.current = null;
    };
  }, [destination.latitude, destination.longitude]);

  useEffect(() => {
    if (mapStatus !== "ready" || !mapInstance.current || !window.google?.maps) return;
    if (!rider) {
      riderMarker.current?.setMap(null);
      riderMarker.current = null;
      return;
    }
    const position = { lat: rider.latitude, lng: rider.longitude };
    if (!riderMarker.current) {
      riderMarker.current = new window.google.maps.Marker({
        map: mapInstance.current,
        position,
        title: "Delivery rider",
        label: "R",
      });
    } else {
      riderMarker.current.setPosition(position);
    }
  }, [mapStatus, rider?.latitude, rider?.longitude]);

  if (mapStatus === "unconfigured") {
    return (
      <div className="tracking-map-fallback">
        <MapPin size={17} />
        <span>Live map needs a Google Maps JavaScript API key.</span>
        <a href={mapsDirectionsUrl(destination.latitude, destination.longitude)} rel="noreferrer" target="_blank">Open Google Maps directions</a>
      </div>
    );
  }
  return (
    <div className="tracking-map-wrap">
      <div aria-label="Map showing customer destination and rider location" className="tracking-map" ref={mapElement} role="img" />
      {mapStatus === "loading" && <span className="tracking-map-message">Loading Google Maps…</span>}
      {mapStatus === "error" && <span className="tracking-map-message" role="alert">Google Maps failed to load. Check the local API key and referrer restrictions.</span>}
    </div>
  );
}

function DeliveryLocationPicker({
  center,
  selectedLocation,
  onSelect,
  radiusKm,
  onUseCurrentLocation,
  gettingLocation,
  heading = "Choose your Markapur delivery pin",
  description = `Search for a street or landmark, tap the map, or drag the pin. Delivery is within ${radiusKm} km of Markapur.`,
}) {
  const mapElement = useRef(null);
  const mapInstance = useRef(null);
  const markerInstance = useRef(null);
  const selectLocationRef = useRef(onSelect);
  const searchController = useRef(null);
  const [mapStatus, setMapStatus] = useState("loading");
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchNoResults, setSearchNoResults] = useState(false);

  useEffect(() => {
    selectLocationRef.current = onSelect;
  }, [onSelect]);

  function chooseSearchResult(result) {
    const position = {
      latitude: Number(result.latitude),
      longitude: Number(result.longitude),
      accuracy: 0,
    };
    if (!Number.isFinite(position.latitude) || !Number.isFinite(position.longitude)) {
      setSearchError("This search result did not include a valid map location.");
      return;
    }
    mapInstance.current?.flyTo([position.latitude, position.longitude], 17);
    selectLocationRef.current(position, result);
    setSearchText(result.displayName);
    setSearchResults([]);
    setSearchError("");
    setSearchNoResults(false);
  }

  async function searchAddress(queryOverride) {
    if (typeof queryOverride !== "string") queryOverride?.preventDefault?.();
    const query = (typeof queryOverride === "string" ? queryOverride : searchText).trim();
    if (query.length < 2) {
      setSearchError("Enter an area, street, or landmark in Markapur.");
      return;
    }
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    setSearchBusy(true);
    setSearchError("");
    setSearchNoResults(false);
    setSearchResults([]);
    try {
      const params = new URLSearchParams({ q: query });
      const { results } = await apiRequest(`/api/geocode/search?${params}`, { signal: controller.signal });
      if (!Array.isArray(results)) throw new Error("OpenStreetMap returned an invalid search response.");
      setSearchResults(results);
      setSearchNoResults(results.length === 0);
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setSearchError(requestError.message || "OpenStreetMap search is temporarily unavailable.");
      }
    } finally {
      if (searchController.current === controller) {
        searchController.current = null;
        setSearchBusy(false);
      }
    }
  }

  useEffect(() => {
    if (!mapElement.current) return undefined;
    const map = L.map(mapElement.current, {
      center: [center.latitude, center.longitude],
      zoom: 14,
      zoomControl: false,
      scrollWheelZoom: true,
    });
    mapInstance.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.circle([center.latitude, center.longitude], {
      radius: radiusKm * 1000,
      color: "#39794c",
      weight: 2,
      fillColor: "#65a879",
      fillOpacity: 0.1,
      interactive: false,
    }).addTo(map);
    const pinIcon = L.divIcon({
      className: "delivery-map-pin-icon",
      html: '<span aria-hidden="true"></span>',
      iconSize: [28, 36],
      iconAnchor: [14, 34],
    });
    const createMarker = (latitude, longitude) => {
      if (!markerInstance.current) {
        markerInstance.current = L.marker([latitude, longitude], { draggable: true, icon: pinIcon }).addTo(map);
        markerInstance.current.on("dragend", () => {
          const point = markerInstance.current.getLatLng();
          selectLocationRef.current({ latitude: point.lat, longitude: point.lng, accuracy: 0 });
        });
      } else {
        markerInstance.current.setLatLng([latitude, longitude]);
      }
    };
    createMarker(center.latitude, center.longitude);
    map.on("click", (event) => {
      createMarker(event.latlng.lat, event.latlng.lng);
      selectLocationRef.current({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
        accuracy: 0,
      });
    });
    setMapStatus("ready");
    return () => {
      searchController.current?.abort();
      map.remove();
      mapInstance.current = null;
      markerInstance.current = null;
    };
  }, [center.latitude, center.longitude, radiusKm]);

  useEffect(() => {
    if (!selectedLocation || mapStatus !== "ready" || !mapInstance.current || !markerInstance.current) return;
    markerInstance.current.setLatLng([selectedLocation.latitude, selectedLocation.longitude]);
    mapInstance.current.flyTo([selectedLocation.latitude, selectedLocation.longitude], Math.max(mapInstance.current.getZoom(), 16));
  }, [mapStatus, selectedLocation?.latitude, selectedLocation?.longitude]);

  return (
    <div className="location-map-picker">
      <div className="location-map-heading">
        <strong><MapPin size={15} /> {heading}</strong>
        <small>{description}</small>
      </div>
      <div className="location-map-search" role="search">
        <Search aria-hidden="true" size={17} />
        <input
          aria-label="Search for an address in Markapur"
          autoComplete="off"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void searchAddress();
            }
          }}
          onChange={(event) => {
            setSearchText(event.target.value);
            setSearchResults([]);
            setSearchError("");
            setSearchNoResults(false);
          }}
          placeholder="Search area, street or landmark"
          value={searchText}
        />
        <button aria-label="Search address" disabled={searchBusy} onClick={() => void searchAddress()} type="button">
          {searchBusy ? "Searching…" : "Search"}
        </button>
      </div>
      {markapurAddressSuggestions.some((place) => !searchText || place.toLocaleLowerCase().includes(searchText.toLocaleLowerCase())) && (
        <div className="location-place-suggestions">
          <strong>Search suggestions · each name is looked up live in OpenStreetMap</strong>
          <div>
            {markapurAddressSuggestions
              .filter((place) => !searchText || place.toLocaleLowerCase().includes(searchText.toLocaleLowerCase()))
              .map((place) => (
                <button
                  key={place}
                  disabled={searchBusy}
                  onClick={() => {
                    setSearchText(place);
                    void searchAddress(place);
                  }}
                  type="button"
                >
                  {place}
                </button>
              ))}
          </div>
        </div>
      )}
      {searchResults.length > 0 && (
        <ul className="location-search-results">
          {searchResults.map((result) => (
            <li key={`${result.placeId || result.osmId}-${result.latitude}-${result.longitude}`}>
              <button onClick={() => chooseSearchResult(result)} type="button">
                <MapPin size={14} />
                <span>
                  <strong>{result.displayName}</strong>
                  <small>{result.latitude.toFixed(6)}, {result.longitude.toFixed(6)} · {result.source}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {searchNoResults && (
        <div className="location-search-fallback" role="status">
          <span>No indexed OpenStreetMap match found for “{searchText.trim()}”. Try another spelling, select the pin manually, and add a nearby landmark or instructions.</span>
          <a href={mapsSearchUrl(searchText.trim())} rel="noreferrer" target="_blank">
            <ExternalLink aria-hidden="true" size={14} /> Search Google Maps
          </a>
        </div>
      )}
      {searchError && <p className="location-search-error" role="status">{searchError}</p>}
      <div className="tracking-map-wrap location-map-wrap">
        <div aria-label="Map of Markapur. Tap a location or drag the pin to select the delivery address." className="tracking-map" ref={mapElement} role="application" />
        {mapStatus === "loading" && <span className="tracking-map-message">Loading map…</span>}
        <button
          className="location-map-current"
          disabled={gettingLocation}
          onClick={onUseCurrentLocation}
          type="button"
        >
          <LocateFixed size={16} /> {gettingLocation ? "Finding location…" : "Use current location"}
        </button>
        <small className="map-attribution">Search and reverse geocoding: OpenStreetMap / Nominatim</small>
      </div>
    </div>
  );
}

function DeliveryProofGallery({ orderId, photoCount }) {
  const [photos, setPhotos] = useState([]);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  async function toggle() {
    if (visible) {
      setVisible(false);
      return;
    }
    setError("");
    try {
      const result = await apiRequest(`/api/orders/${orderId}/proofs`);
      setPhotos(result.photos.filter(Boolean));
      setVisible(true);
    } catch (requestError) {
      setError(requestError.message);
    }
  }
  return (
    <div className="proof-gallery">
      <button className="proof-gallery-toggle" onClick={toggle} type="button">
        <Camera size={14} /> {visible ? "Hide" : "View"} delivery photos ({photoCount}/3)
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
      {visible && <div className="proof-gallery-images">{photos.map((photo, index) => <img alt={`Delivery proof ${index + 1}`} key={index} src={photo} />)}</div>}
    </div>
  );
}

function WhatsAppLink({ children, message, className = "", onClick }) {
  return (
    <button className={className} type="button" onClick={() => {
      openWhatsApp(message);
      onClick?.();
    }}>
      {children}
    </button>
  );
}

function FoodImage({ src, alt, ...props }) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      {...props}
      alt={alt}
      onError={() => setFailed(true)}
      src={failed ? "/assets/fruit-placeholder.svg" : src}
    />
  );
}

function Header({ cartCount, onCartOpen, user, onAccount, onAdmin }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navItems = [
    ["Our picks", "#menu"],
    ["Monthly packs", "#monthly"],
    ["Build a bowl", "#build"],
    ["Our story", "#story"],
    ["Contact", "#contact"],
  ];

  return (
    <header className="site-header">
      <a aria-label="Froot Bowl Markapur home" className="brand" href="#home">
        <img src="/assets/froot-bowl-logo.jpeg" alt="Froot Bowl logo" />
        <span className="brand-copy">
          <strong>Froot Bowl</strong>
          <small>MARKAPUR</small>
        </span>
      </a>
      <nav aria-label="Main navigation" className={menuOpen ? "main-nav open" : "main-nav"}>
        {navItems.map(([label, href]) => (
          <a href={href} key={label} onClick={() => setMenuOpen(false)}>
            {label}
          </a>
        ))}
        <a className="mobile-nav-order" href="#menu" onClick={() => setMenuOpen(false)}>
          Explore the menu <ArrowRight size={16} />
        </a>
      </nav>
      <div className="header-actions">
        {user?.role === "admin" ? (
          <button className="account-button" onClick={onAdmin} type="button">
            <ShieldCheck size={17} /><span>Admin</span>
          </button>
        ) : (
          <button className="account-button" onClick={onAccount} type="button">
            {user?.avatarData ? (
              <img alt="" className="account-avatar" src={user.avatarData} />
            ) : user ? (
              <span className="account-initials">{user.name.slice(0, 1).toUpperCase()}</span>
            ) : (
              <UserRound size={17} />
            )}
            <span>{user ? "My orders" : "Sign in"}</span>
          </button>
        )}
        <button
          aria-label={`Open bag with ${cartCount} items`}
          className="bag-button"
          onClick={onCartOpen}
          type="button"
        >
          <ShoppingBag size={19} strokeWidth={1.8} />
          <span>Bag</span>
          {cartCount > 0 && <b className="bag-count">{cartCount}</b>}
        </button>
        <a className="button button-small button-green header-order" href="#menu">
          Order now <ArrowUpRight size={16} />
        </a>
        <button
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          className="menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          type="button"
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}

function ProductCard({ product, onAdd }) {
  return (
    <article className="product-card">
      <div className="product-photo">
        <FoodImage alt={product.name} loading="lazy" src={product.image} />
        <span className="product-tag">{product.tag}</span>
        <button
          aria-label={`Add ${product.name} to your bag`}
          className="quick-add"
          onClick={() => onAdd(product)}
          type="button"
        >
          <Plus size={19} />
        </button>
      </div>
      <div className="product-info">
        <div className="product-heading">
          <div>
            <span className="eyebrow">{product.category}</span>
            <h3>{product.name}</h3>
          </div>
          <span className="product-price">₹{product.price}</span>
        </div>
        <p>{product.note}</p>
        <button className="text-link" onClick={() => onAdd(product)} type="button">
          Add to your bag <ArrowRight size={15} />
        </button>
      </div>
    </article>
  );
}

function CartDrawer({ cart, onClose, onQuantity, onRemove, onCheckout, onWhatsApp }) {
  const itemCount = cart.reduce((count, item) => count + item.quantity, 0);
  const message = useMemo(() => {
    const lines = cart
      .map((item) => {
        const additions = item.customization?.length
          ? ` (${item.customization.join(", ")})`
          : "";
        return `• ${item.name}${additions} × ${item.quantity}`;
      })
      .join("\n");
    return `Hello Froot Bowl Markapur!\n\nI'd like to enquire about these fruit boxes:\n${lines}\n\nPlease confirm availability and delivery details.\n\nThank you!`;
  }, [cart]);

  return (
    <>
      <button aria-label="Close shopping bag" className="drawer-scrim" onClick={onClose} />
      <aside aria-label="Your shopping bag" aria-modal="true" className="cart-drawer" role="dialog">
        <div className="drawer-header">
          <div>
            <span className="eyebrow">YOUR SELECTION</span>
            <h2>Your bag <span>({itemCount})</span></h2>
          </div>
          <button aria-label="Close bag" className="icon-button" onClick={onClose} type="button">
            <X />
          </button>
        </div>
        {cart.length === 0 ? (
          <div className="empty-bag">
            <span className="empty-bag-icon"><ShoppingBag /></span>
            <h3>Your bag is looking fresh.</h3>
            <p>Add something colorful from our menu to start your enquiry.</p>
            <a className="button button-green" href="#menu" onClick={onClose}>
              Explore our picks <ArrowRight size={16} />
            </a>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {cart.map((item) => (
                <div className="cart-item" key={item.id}>
                  <FoodImage alt="" src={item.image} />
                  <div className="cart-item-copy">
                    <h3>{item.name}</h3>
                    {item.customization?.length > 0 && (
                      <p>{item.customization.join(", ")}</p>
                    )}
                    <span>₹{item.price} each</span>
                    <div className="quantity-control">
                      <button
                        aria-label={`Decrease ${item.name} quantity`}
                        onClick={() => onQuantity(item.id, -1)}
                        type="button"
                      >
                        <Minus size={13} />
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        aria-label={`Increase ${item.name} quantity`}
                        onClick={() => onQuantity(item.id, 1)}
                        type="button"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                  <button
                    aria-label={`Remove ${item.name}`}
                    className="remove-item"
                    onClick={() => onRemove(item.id)}
                    type="button"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="drawer-bottom">
              <div className="delivery-note">
                <Truck size={17} />
                <span>Free home delivery in Markapur</span>
                <Check size={15} />
              </div>
              <div className="cart-total">
                <span>Estimated total<small>Free delivery in Markapur</small></span>
                <strong>₹{cart.reduce((sum, item) => sum + item.price * item.quantity, 0)}</strong>
              </div>
              <button className="button button-green checkout-button" onClick={onCheckout} type="button">
                Continue to address <ArrowRight size={17} />
              </button>
              <WhatsAppLink className="cart-whatsapp-link" message={message} onClick={onWhatsApp}>
                <MessageCircle size={15} /> Ask about these boxes on WhatsApp
              </WhatsAppLink>
              <small className="not-confirmed">You’ll review your address and order before confirming.</small>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function BuildYourBowl({ onEnquire }) {
  const [size, setSize] = useState("Regular");
  const [fruits, setFruits] = useState(["Seasonal fruits"]);
  const [toppings, setToppings] = useState([]);

  function toggleFruit(item) {
    setFruits((selected) =>
      selected.includes(item)
          ? selected.length > 1
            ? selected.filter((choice) => choice !== item)
            : selected
          : [...selected, item],
      );
  }

  function toggleTopping(item) {
    setToppings((selected) =>
      selected.includes(item)
        ? selected.filter((choice) => choice !== item)
        : [...selected, item],
    );
  }

  function addCustomBowl() {
    onEnquire(`${size} custom fruit bowl`, [...fruits, ...toppings]);
  }

  return (
    <div className="builder-card">
      <div className="builder-copy">
        <span className="eyebrow eyebrow-light">MADE YOUR WAY</span>
        <h3>Your bowl.<br />Your kind of fresh.</h3>
        <p>Choose a size, pick your fruit, then tell us what sounds good. We’ll confirm what’s fresh and available today.</p>
        <div className="builder-note"><Sparkles size={17} /> Price and availability confirmed with us</div>
      </div>
      <div className="builder-form">
        <fieldset>
          <legend><span>01</span> Choose your size</legend>
          <div className="choice-row">
            {bowlSizes.map((option) => (
              <button
                aria-pressed={size === option}
                className={size === option ? "choice selected" : "choice"}
                key={option}
                onClick={() => setSize(option)}
                type="button"
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend><span>02</span> Pick your fruits <small>Select more than one</small></legend>
          <div className="choice-row choice-wrap">
            {fruitChoices.map((option) => (
              <button
                aria-pressed={fruits.includes(option)}
                className={fruits.includes(option) ? "choice selected" : "choice"}
                key={option}
                onClick={() => toggleFruit(option)}
                type="button"
              >
                {fruits.includes(option) && <Check size={13} />}
                {option}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend><span>03</span> Add a little extra <small>Optional</small></legend>
          <div className="choice-row choice-wrap">
            {toppingChoices.map((option) => (
              <button
                aria-pressed={toppings.includes(option)}
                className={toppings.includes(option) ? "choice selected" : "choice"}
                key={option}
                onClick={() => toggleTopping(option)}
                type="button"
              >
                {toppings.includes(option) && <Check size={13} />}
                {option}
              </button>
            ))}
          </div>
        </fieldset>
        <button className="button button-green builder-submit" onClick={addCustomBowl} type="button">
          Ask about your custom bowl <MessageCircle size={16} />
        </button>
      </div>
    </div>
  );
}

const orderSteps = [
  ["placed", "Order received", "We have your order details."],
  ["confirmed", "Order confirmed", "The shop has accepted your order."],
  ["preparing", "Being prepared", "Your fruit box is being put together."],
  ["out_for_delivery", "On the way", "Your order is on its way."],
  ["delivered", "Delivered", "Enjoy your fresh fruit box!"],
];

const orderStatusLabels = {
  placed: "Order received",
  awaiting_confirmation: "Awaiting confirmation",
  confirmed: "Order confirmed",
  preparing: "Being prepared",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function periodStart(period, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === "week") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  } else if (period === "month") {
    start.setDate(1);
  } else if (period === "year") {
    start.setMonth(0, 1);
  }
  return start;
}

async function apiRequest(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("We couldn’t connect to Froot Bowl. Check your connection and try again.");
  }
  if (response.status === 204) return {};
  const responseText = await response.text();
  let result;
  try {
    result = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error(
      response.ok
        ? "The service returned an unreadable response. Please try again."
        : `The service is temporarily unavailable (error ${response.status}). Please try again.`,
    );
  }
  if (!response.ok) {
    throw new Error(result.error || "The request could not be completed.");
  }
  return result;
}

function AuthDialog({ purpose, initialAdmin = false, onClose, onSignedIn }) {
  const [mode, setMode] = useState("login");
  const [isAdmin, setIsAdmin] = useState(initialAdmin);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (mode === "signup" && values.password !== values.confirmPassword) {
      setError("Your passwords don’t match.");
      setBusy(false);
      return;
    }
    delete values.confirmPassword;
    delete values.acceptTerms;
    try {
      const result = await apiRequest(
        mode === "signup" ? "/api/auth/register" : "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            ...values,
            ...(isAdmin ? { adminOnly: true } : {}),
          }),
        },
      );
      onSignedIn(result.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section aria-labelledby="auth-title" aria-modal="true" className="site-modal auth-modal" role="dialog">
        <button aria-label="Close" className="icon-button modal-close" onClick={onClose} type="button"><X /></button>
        <span className="modal-mark"><UserRound /></span>
        <span className="eyebrow">{isAdmin ? "STAFF ACCESS" : purpose === "checkout" ? "A FRESH ORDER STARTS HERE" : "FROOT BOWL ACCOUNT"}</span>
        <h2 id="auth-title">{isAdmin ? "Admin sign in" : mode === "signup" ? "Create your account." : "Welcome back."}</h2>
        <p className="modal-intro">
          {isAdmin
            ? "Sign in with the admin credentials configured on the backend."
            : mode === "signup"
              ? "Create an account to add your address, place orders, and track delivery."
              : purpose === "checkout"
                ? "Sign in or create an account before continuing to checkout."
                : "Sign in to see your orders and delivery updates."}
        </p>
        <form className="dialog-form" onSubmit={submit}>
          {mode === "signup" && !isAdmin && (
            <>
              <label>Full name<input autoComplete="name" maxLength="80" name="name" required /></label>
              <label>Phone number<input autoComplete="tel" inputMode="tel" maxLength="20" name="phone" required /></label>
            </>
          )}
          <label>Email address<input autoComplete="email" maxLength="254" name="email" required type="email" /></label>
          <label>Password
            <span className="password-input-wrap">
              <input autoComplete={mode === "signup" ? "new-password" : "current-password"} maxLength="128" minLength={mode === "signup" ? 8 : undefined} name="password" required type={showPassword ? "text" : "password"} />
              <button aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} type="button">
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>
          {mode === "signup" && !isAdmin && (
            <>
              <label>Confirm password<input autoComplete="new-password" maxLength="128" minLength="8" name="confirmPassword" required type="password" /></label>
              <label className="terms-choice">
                <input name="acceptTerms" required type="checkbox" />
                <span>I agree to use my contact and delivery details to process my orders.</span>
              </label>
            </>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-green dialog-submit" disabled={busy} type="submit">
            {busy ? "Please wait…" : isAdmin ? "Sign in to admin" : mode === "signup" ? "Create account" : "Sign in"}
            <ArrowRight size={16} />
          </button>
        </form>
        {!isAdmin && (
          <p className="auth-switch">
            {mode === "signup" ? "Already have an account?" : "New to Froot Bowl?"}
            <button onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); }} type="button">
              {mode === "signup" ? "Sign in" : "Create account"}
            </button>
          </p>
        )}
        {isAdmin && <a className="admin-switch" href="/">Return to the shop</a>}
      </section>
    </div>
  );
}

function CheckoutDialog({ cart, user, onClose, onPlaceOrder }) {
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [location, setLocation] = useState(null);
  const [mapPin, setMapPin] = useState(null);
  const [markapurCenter, setMarkapurCenter] = useState({ latitude: 15.7351, longitude: 79.2695 });
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState(6);
  const [locationError, setLocationError] = useState("");
  const [gettingLocation, setGettingLocation] = useState(false);
  const [addressLookupBusy, setAddressLookupBusy] = useState(false);
  const [addressLookupError, setAddressLookupError] = useState("");
  const [addressFields, setAddressFields] = useState({
    line1: "",
    area: "",
    pincode: "",
    landmark: "",
    recipientName: user.name,
    phone: user.phone,
    buildingName: "",
    instructions: "",
    addressType: "Home",
    verificationStatus: "unverified",
    osmDisplayName: "",
    osmType: "",
    osmId: null,
  });
  const [selectedOsmPlace, setSelectedOsmPlace] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState("");
  const [distanceMeters, setDistanceMeters] = useState(null);
  const [addressBusy, setAddressBusy] = useState(false);
  const [addressMessage, setAddressMessage] = useState("");
  const addressLookupController = useRef(null);
  const checkoutForm = useRef(null);
  const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);

  useEffect(() => {
    apiRequest("/api/config")
      .then((config) => {
        setMarkapurCenter(config.markapurCenter);
        setDeliveryRadiusKm(config.deliveryRadiusKm);
      })
      .catch((configError) => setLocationError(configError.message));
    apiRequest("/api/profile/addresses")
      .then(async ({ addresses, selectedAddressId }) => {
        setSavedAddresses(addresses);
        const defaultAddress =
          addresses.find((address) => address.id === selectedAddressId) ||
          addresses.find((address) => address.isDefault);
        if (defaultAddress) {
          const savedLocation = {
            latitude: defaultAddress.latitude,
            longitude: defaultAddress.longitude,
          };
          const availability = await apiRequest("/api/coverage/check", {
            method: "POST",
            body: JSON.stringify({ location: savedLocation }),
          });
          setSelectedSavedAddressId(defaultAddress.id);
          setAddressFields((current) => ({
            ...current,
            line1: defaultAddress.line1,
            area: defaultAddress.area,
            pincode: defaultAddress.pincode,
            landmark: defaultAddress.landmark,
            recipientName: defaultAddress.recipientName || user.name,
            phone: defaultAddress.phone || user.phone,
            buildingName: defaultAddress.buildingName || "",
            instructions: defaultAddress.instructions || "",
            addressType: defaultAddress.addressType || "Home",
            verificationStatus: defaultAddress.verificationStatus || "unverified",
            osmDisplayName: defaultAddress.osmDisplayName || "",
            osmType: defaultAddress.osmType || "",
            osmId: defaultAddress.osmId || null,
          }));
          setSelectedOsmPlace(defaultAddress.osmDisplayName
            ? { displayName: defaultAddress.osmDisplayName, latitude: savedLocation.latitude, longitude: savedLocation.longitude, source: "OpenStreetMap / Nominatim" }
            : null);
          setMapPin(savedLocation);
          setDistanceMeters(availability.distanceMeters);
          if (availability.serviceable) setLocation(savedLocation);
          else setLocationError(availability.message);
        }
      })
      .catch((addressError) => setError(addressError.message));
  }, []);

  useEffect(() => () => addressLookupController.current?.abort(), []);

  function updateAddressField(field, value) {
    const affectsVerification = ["line1", "area", "pincode", "landmark"].includes(field);
    setAddressFields((current) => ({
      ...current,
      [field]: value,
      ...(affectsVerification ? { verificationStatus: "unverified" } : {}),
    }));
  }

  async function selectDeliveryLocation(candidate, resolvedPlace = null) {
    setMapPin(candidate);
    setSelectedSavedAddressId("");
    let availability;
    try {
      availability = await apiRequest("/api/coverage/check", {
        method: "POST",
        body: JSON.stringify({ location: candidate }),
      });
    } catch (requestError) {
      setLocation(null);
      setLocationError(requestError.message);
      return;
    }
    setDistanceMeters(availability.distanceMeters);
    if (!availability.serviceable) {
      addressLookupController.current?.abort();
      setAddressLookupBusy(false);
      setLocation(null);
      setAddressFields((current) => ({
        ...current,
        line1: "",
        area: "",
        pincode: "",
        landmark: "",
      }));
      setLocationError(availability.message);
      return;
    }
    setLocation(candidate);
    setLocationError("");
    setAddressLookupError("");
    setSelectedOsmPlace(resolvedPlace);
    setAddressFields((current) => ({
      ...current,
      line1: resolvedPlace ? addressFromMapResult(resolvedPlace).line1 : "",
      area: resolvedPlace ? addressFromMapResult(resolvedPlace).area : "",
      pincode: resolvedPlace ? addressFromMapResult(resolvedPlace).pincode : "",
      landmark: resolvedPlace ? addressFromMapResult(resolvedPlace).landmark : "",
      verificationStatus: resolvedPlace?.address?.house_number ? "osm-verified" : "unverified",
      osmDisplayName: resolvedPlace?.displayName || "",
      osmType: resolvedPlace?.osmType || "",
      osmId: resolvedPlace?.osmId || null,
    }));
    addressLookupController.current?.abort();
    const controller = new AbortController();
    addressLookupController.current = controller;
    setAddressLookupBusy(true);
    try {
      let place = resolvedPlace;
      if (!place?.address) {
        const params = new URLSearchParams({
          lat: String(candidate.latitude),
          lon: String(candidate.longitude),
        });
        const result = await apiRequest(`/api/geocode/reverse?${params}`, { signal: controller.signal });
        place = result.place;
      }
      if (addressLookupController.current !== controller) return;
      if (!place?.address) {
        setSelectedOsmPlace(null);
        setAddressLookupError("OpenStreetMap has no mapped street or landmark at this pin. Add the locality, nearby landmark, and delivery instructions.");
      } else {
        setSelectedOsmPlace(place);
        setAddressFields((current) => ({
          ...current,
          ...addressFromMapResult(place),
          verificationStatus: resolvedPlace?.address?.house_number ? "osm-verified" : "unverified",
          osmDisplayName: place.displayName || "",
          osmType: place.osmType || "",
          osmId: place.osmId || null,
        }));
      }
    } catch (lookupError) {
      if (lookupError.name !== "AbortError" && addressLookupController.current === controller) {
        setSelectedOsmPlace(null);
        setAddressLookupError(`${lookupError.message} This pin is unverified; enter the locality, nearby landmark, and delivery instructions.`);
      }
    } finally {
      if (addressLookupController.current === controller) {
        addressLookupController.current = null;
        setAddressLookupBusy(false);
      }
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationError("Location is not available in this browser. Please enable location or use a supported device.");
      return;
    }

    setGettingLocation(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const current = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        };
        setGettingLocation(false);
        void selectDeliveryLocation(current).catch((requestError) => setLocationError(requestError.message));
      },
      (geoError) => {
        setGettingLocation(false);
        setLocationError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Allow location access, or choose the recipient’s Markapur address on the map."
            : "We couldn’t get your location. Please try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await onPlaceOrder({
        items: cart.map((item) => ({ productId: item.id, quantity: item.quantity })),
        paymentMethod,
        address: {
          line1: values.line1,
          area: values.area,
          city: values.city,
          pincode: values.pincode,
          landmark: values.landmark,
          recipientName: values.recipientName,
          phone: values.phone,
          buildingName: values.buildingName,
          instructions: values.instructions,
          addressType: values.addressType,
          verificationStatus: addressFields.verificationStatus,
          osmDisplayName: addressFields.osmDisplayName,
          osmType: addressFields.osmType,
          osmId: addressFields.osmId,
        },
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }

    async function selectSavedAddress(address) {
      setAddressBusy(true);
      setAddressMessage("");
      setLocationError("");
      try {
        const point = { latitude: address.latitude, longitude: address.longitude };
        const availability = await apiRequest("/api/coverage/check", {
          method: "POST",
          body: JSON.stringify({ location: point }),
        });
        if (!availability.serviceable) {
          setLocation(null);
          setMapPin(point);
          setDistanceMeters(availability.distanceMeters);
          setLocationError(availability.message);
          return;
        }
        const result = await apiRequest(`/api/profile/addresses/${address.id}/default`, {
          method: "PUT",
        });
        setSavedAddresses(result.addresses);
        setSelectedSavedAddressId(address.id);
        setLocation(point);
        setMapPin(point);
        setDistanceMeters(availability.distanceMeters);
        setAddressFields({
          line1: address.line1,
          area: address.area,
          pincode: address.pincode,
          landmark: address.landmark,
          recipientName: address.recipientName || user.name,
          phone: address.phone || user.phone,
          buildingName: address.buildingName || "",
          instructions: address.instructions || "",
          addressType: address.addressType || "Home",
          verificationStatus: address.verificationStatus || "unverified",
          osmDisplayName: address.osmDisplayName || "",
          osmType: address.osmType || "",
          osmId: address.osmId || null,
        });
        setSelectedOsmPlace(address.osmDisplayName
          ? { displayName: address.osmDisplayName, latitude: point.latitude, longitude: point.longitude, source: "OpenStreetMap / Nominatim" }
          : null);
        setLocationError("");
        setAddressMessage("Saved address selected.");
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setAddressBusy(false);
      }
    }

    async function saveAddress() {
      if (!checkoutForm.current || !location) return;
      setAddressBusy(true);
      setAddressMessage("");
      setError("");
      try {
        const values = Object.fromEntries(new FormData(checkoutForm.current));
        const result = await apiRequest("/api/profile/addresses", {
          method: "POST",
          body: JSON.stringify({
            address: {
              line1: values.line1,
              area: values.area,
              city: values.city,
              pincode: values.pincode,
              landmark: values.landmark,
              recipientName: values.recipientName,
              phone: values.phone,
              buildingName: values.buildingName,
              instructions: values.instructions,
              addressType: values.addressType,
              verificationStatus: addressFields.verificationStatus,
              osmDisplayName: addressFields.osmDisplayName,
              osmType: addressFields.osmType,
              osmId: addressFields.osmId,
            },
            location,
            setDefault: true,
          }),
        });
        setSavedAddresses(result.addresses);
        setSelectedSavedAddressId(result.address.id);
        setAddressMessage("Address saved to your account.");
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setAddressBusy(false);
      }
    }

    async function deleteSavedAddress() {
      if (!selectedSavedAddressId) return;
      setAddressBusy(true);
      setAddressMessage("");
      try {
        const result = await apiRequest(`/api/profile/addresses/${selectedSavedAddressId}`, {
          method: "DELETE",
        });
        setSavedAddresses(result.addresses);
        setSelectedSavedAddressId(result.selectedAddressId || "");
        const fallback = result.addresses.find((address) => address.id === result.selectedAddressId);
        if (fallback) await selectSavedAddress(fallback);
        else {
          setLocation(null);
          setMapPin(null);
        }
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setAddressBusy(false);
      }
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section aria-labelledby="checkout-title" aria-modal="true" className="site-modal checkout-modal" role="dialog">
        <div className="modal-heading">
          <div><span className="eyebrow">DELIVERY DETAILS</span><h2 id="checkout-title">Where should we deliver?</h2></div>
          <button aria-label="Close checkout" className="icon-button" onClick={onClose} type="button"><X /></button>
        </div>
        <p className="checkout-user"><UserRound size={15} /> Ordering as <strong>{user.name}</strong> · {user.phone}</p>
        {savedAddresses.length > 0 && (
          <div className="saved-address-picker">
            <label htmlFor="saved-address">Saved delivery addresses</label>
            <div>
              <select
                disabled={addressBusy}
                id="saved-address"
                onChange={(event) => {
                  const address = savedAddresses.find((entry) => entry.id === event.target.value);
                  if (address) void selectSavedAddress(address);
                  else {
                    setSelectedSavedAddressId("");
                    setLocation(null);
                    setMapPin(null);
                    setDistanceMeters(null);
                    setAddressMessage("");
                  }
                }}
                value={selectedSavedAddressId}
              >
                <option value="">Enter a new address</option>
                {savedAddresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.addressType}: {address.formattedAddress}
                  </option>
                ))}
              </select>
              {selectedSavedAddressId && (
                <button
                  className="avatar-remove-button"
                  disabled={addressBusy}
                  onClick={() => void deleteSavedAddress()}
                  type="button"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
        {addressMessage && <p className="orders-notice" role="status">{addressMessage}</p>}
        <form className="dialog-form checkout-form" onSubmit={submit} ref={checkoutForm}>
          <label>Recipient full name<input autoComplete="name" maxLength="80" name="recipientName" onChange={(event) => setAddressFields((current) => ({ ...current, recipientName: event.target.value }))} required value={addressFields.recipientName} /></label>
          <label>Recipient mobile number<input autoComplete="tel" inputMode="tel" maxLength="20" name="phone" onChange={(event) => setAddressFields((current) => ({ ...current, phone: event.target.value }))} required value={addressFields.phone} /></label>
          <label>House number / street (optional if not mapped)<input autoComplete="street-address" maxLength="160" name="line1" onChange={(event) => updateAddressField("line1", event.target.value)} placeholder="Enter the house number or street if known" value={addressFields.line1} /></label>
          <label>Building or apartment<input autoComplete="address-line2" maxLength="120" name="buildingName" onChange={(event) => setAddressFields((current) => ({ ...current, buildingName: event.target.value }))} value={addressFields.buildingName} /></label>
          <div className="form-two-columns">
            <label>Area / locality<input autoComplete="address-level3" maxLength="100" minLength="2" name="area" onChange={(event) => updateAddressField("area", event.target.value)} placeholder="Enter the locality if it is not mapped" required value={addressFields.area} /></label>
            <label>City<input autoComplete="address-level2" defaultValue="Markapur" maxLength="80" name="city" readOnly required /></label>
          </div>
          <div className="form-two-columns">
            <label>PIN code (optional)<input autoComplete="postal-code" inputMode="numeric" maxLength="6" name="pincode" onChange={(event) => updateAddressField("pincode", event.target.value)} pattern="[0-9]{6}" value={addressFields.pincode} /></label>
            <label>Nearby landmark<input maxLength="120" name="landmark" onChange={(event) => updateAddressField("landmark", event.target.value)} placeholder="Add a nearby landmark if available" value={addressFields.landmark} /></label>
          </div>
          <div className="form-two-columns">
            <label>Address type
              <select
                name="addressType"
                onChange={(event) => setAddressFields((current) => ({ ...current, addressType: event.target.value }))}
                value={addressFields.addressType}
              >
                <option>Home</option><option>Work</option><option>Other</option>
              </select>
            </label>
            <label>Delivery instructions<input maxLength="300" name="instructions" onChange={(event) => setAddressFields((current) => ({ ...current, instructions: event.target.value }))} placeholder="Directions that will help find the pin" value={addressFields.instructions} /></label>
          </div>
          <div className="location-picker">
            <div>
              <strong><MapPin size={16} /> Delivery location</strong>
              <small>You can order from anywhere. Use your current location if it is in Markapur, or choose the recipient’s address within {deliveryRadiusKm} km of Markapur.</small>
            </div>
            <DeliveryLocationPicker
              center={markapurCenter}
              gettingLocation={gettingLocation}
              onSelect={selectDeliveryLocation}
              onUseCurrentLocation={useCurrentLocation}
              radiusKm={deliveryRadiusKm}
              selectedLocation={mapPin}
            />
            {location && (
              <div className="location-verification" role="status">
                <strong className={addressFields.verificationStatus === "osm-verified" ? "verified" : "unverified"}>
                  {addressFields.verificationStatus === "osm-verified"
                    ? "OpenStreetMap house address match"
                    : selectedOsmPlace
                      ? "Mapped street/landmark found · house/pin unverified"
                      : "Unverified map pin"}
                </strong>
                <span>Selected street or nearby landmark: {selectedOsmPlace?.displayName || "No mapped street or landmark returned for this pin."}</span>
                <small>Selected coordinates: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</small>
              </div>
            )}
            {location && (
              <div className="location-success">
                <CheckCircle2 size={15} />
                <span>
                  {addressLookupBusy
                    ? "Finding the exact address at this pin…"
                    : `Delivery pin selected${addressFields.line1 ? ` · ${addressFields.line1}` : ""}${addressFields.area ? ` · ${addressFields.area}` : ""}`}
                  {location.accuracy > 0 && ` · GPS ±${Math.round(location.accuracy)} m`}
                  {Number.isFinite(distanceMeters) && ` · ${distanceMeters} m from service center`}
                </span>
              </div>
            )}
            {location && addressFields.verificationStatus === "unverified" && (
              <p className="location-unverified-note">This pin is not a verified house address. Add a nearby landmark and clear delivery instructions so the shop can find you.</p>
            )}
            {!selectedSavedAddressId && location && (
              <button
                className="button button-light"
                disabled={addressBusy || addressLookupBusy}
                onClick={() => void saveAddress()}
                type="button"
              >
                {addressBusy ? "Saving address…" : "Save address for next time"}
              </button>
            )}
            {addressLookupError && <p className="location-search-error" role="status">{addressLookupError}</p>}
            {locationError && <p className="form-error" role="alert">{locationError}</p>}
          </div>
          <fieldset className="payment-options">
            <legend>How would you like to confirm?</legend>
            <label className={paymentMethod === "cod" ? "payment-choice selected" : "payment-choice"}>
              <input checked={paymentMethod === "cod"} name="payment" onChange={() => setPaymentMethod("cod")} type="radio" />
              <span><strong>Cash on delivery</strong><small>Pay when your order arrives</small></span>
            </label>
            <label className={paymentMethod === "whatsapp" ? "payment-choice selected" : "payment-choice"}>
              <input checked={paymentMethod === "whatsapp"} name="payment" onChange={() => setPaymentMethod("whatsapp")} type="radio" />
              <span><strong>Confirm on WhatsApp</strong><small>We’ll message to confirm your order</small></span>
            </label>
          </fieldset>
          <div className="checkout-summary">
            <span>{cart.reduce((count, item) => count + item.quantity, 0)} fruit box(es) <small>Free home delivery</small></span>
            <strong>₹{subtotal}</strong>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-green dialog-submit" disabled={busy || !location} type="submit">
            {busy ? "Placing order…" : "Confirm order"} <CheckCircle2 size={17} />
          </button>
          <p className="form-footnote">No online payment is collected. The shop will confirm your order.</p>
        </form>
      </section>
    </div>
  );
}

function OrdersDialog({ onClose, onSignOut, admin = false, user, onUserUpdated }) {
  const [orders, setOrders] = useState([]);
  const [coverage, setCoverage] = useState({
    center: { latitude: 15.7351, longitude: 79.2695 },
    radiusKm: 6,
    enabled: true,
    referencePoint: "Markapuram, Andhra Pradesh",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [busyOrder, setBusyOrder] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [coverageBusy, setCoverageBusy] = useState(false);
  const [editingAddressOrderId, setEditingAddressOrderId] = useState("");
  const [addressSaving, setAddressSaving] = useState(false);

  async function refreshOrders() {
    try {
      const result = await apiRequest("/api/orders");
      setOrders(result.orders);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }

    async function saveCoverage(event) {
      event.preventDefault();
      setCoverageBusy(true);
      setError("");
      setNotice("");
      const form = new FormData(event.currentTarget);
      try {
        const result = await apiRequest("/api/admin/coverage", {
          method: "PUT",
          body: JSON.stringify({
            center: coverage.center,
            radiusKm: Number(form.get("radiusKm")),
            referencePoint: form.get("referencePoint"),
            enabled: form.get("enabled") === "on",
          }),
        });
        setCoverage(result.coverage);
        setNotice("Delivery coverage settings saved.");
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setCoverageBusy(false);
      }
    }

    function useAdminCurrentLocation() {
      if (!navigator.geolocation) {
        setError("Location is not available in this browser.");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => setCoverage((current) => ({
          ...current,
          center: { latitude: coords.latitude, longitude: coords.longitude },
        })),
        (geoError) => setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Allow location access or select the service center on the map."
            : "We couldn’t get the service-center location. Select it on the map instead.",
        ),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
      );
    }
  }

  useEffect(() => {
    refreshOrders();
    const timer = window.setInterval(refreshOrders, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!admin) return;
    apiRequest("/api/admin/coverage")
      .then((result) => setCoverage(result.coverage))
      .catch((coverageError) => setError(coverageError.message));
  }, [admin]);

  async function updateStatus(order, status) {
    setBusyOrder(order.id);
    setError("");
    try {
      await apiRequest(`/api/admin/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await refreshOrders();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyOrder("");
    }
  }

  async function saveOrderAddress(order, event) {
    event.preventDefault();
    setAddressSaving(true);
    setError("");
    setNotice("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await apiRequest(`/api/admin/orders/${order.id}/address`, {
        method: "PATCH",
        body: JSON.stringify({
          address: {
            line1: values.line1,
            area: values.area,
            pincode: values.pincode,
            landmark: values.landmark,
            instructions: values.instructions,
          },
          location: {
            latitude: Number(values.latitude),
            longitude: Number(values.longitude),
          },
          markVerified: values.markVerified === "on",
        }),
      });
      setOrders((current) => current.map((entry) => entry.id === order.id ? result.order : entry));
      setEditingAddressOrderId("");
      setNotice(`Delivery address reviewed for order ${order.id}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAddressSaving(false);
    }
  }

  async function deleteOrder(order) {
    setBusyOrder(order.id);
    setError("");
    try {
      await apiRequest(`/api/admin/orders/${order.id}`, { method: "DELETE" });
      await refreshOrders();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyOrder("");
    }
  }

  async function cancelOrder(order) {
    setBusyOrder(order.id);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest(`/api/orders/${order.id}/cancel`, { method: "POST" });
      setNotice(
        result.accountBlocked
          ? `Your account linked to ${user.email} is blocked after more than 3 cancellations. Contact us on WhatsApp to restore access.`
          : `Order cancelled. ${4 - result.cancellations} more cancellation${result.cancellations === 1 ? "" : "s"} will block the account linked to ${user.email}.`,
      );
      await refreshOrders();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyOrder("");
    }
  }

  async function updateProfilePhoto(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      setPhotoError("Choose an image under 8 MB.");
      return;
    }

    setPhotoBusy(true);
    setPhotoError("");
    try {
      const bitmap = await createImageBitmap(file);
      const side = Math.min(bitmap.width, bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your browser couldn’t prepare this photo.");
      context.drawImage(
        bitmap,
        (bitmap.width - side) / 2,
        (bitmap.height - side) / 2,
        side,
        side,
        0,
        0,
        256,
        256,
      );
      bitmap.close();

      let avatarData = canvas.toDataURL("image/jpeg", 0.82);
      for (const quality of [0.72, 0.6, 0.48]) {
        if (avatarData.length <= 270_000) break;
        avatarData = canvas.toDataURL("image/jpeg", quality);
      }
      if (avatarData.length > 270_000) {
        throw new Error("This photo is too large. Please choose a smaller image.");
      }

      const result = await apiRequest("/api/profile/avatar", {
        method: "PUT",
        body: JSON.stringify({ avatarData }),
      });
      onUserUpdated(result.user);
    } catch (photoRequestError) {
      setPhotoError(photoRequestError.message || "We couldn’t update your profile photo.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removeProfilePhoto() {
    setPhotoBusy(true);
    setPhotoError("");
    try {
      const result = await apiRequest("/api/profile/avatar", { method: "DELETE" });
      onUserUpdated(result.user);
    } catch (photoRequestError) {
      setPhotoError(photoRequestError.message);
    } finally {
      setPhotoBusy(false);
    }
  }

  const dashboardPeriods = admin
    ? ["day", "week", "month", "year"].map((period) => {
        const start = periodStart(period);
        const periodOrders = orders.filter((order) => new Date(order.createdAt) >= start);
        const deliveredOrders = orders.filter((order) => {
          const deliveredAt = order.statusHistory.find((entry) => entry.status === "delivered")?.at;
          return deliveredAt && new Date(deliveredAt) >= start;
        });
        return {
          period,
          orderCount: periodOrders.length,
          cancelledCount: periodOrders.filter((order) => order.status === "cancelled").length,
          deliveredCount: deliveredOrders.length,
          revenue: deliveredOrders.reduce((total, order) => total + order.total, 0),
        };
      })
    : [];

  return (
    <div className="modal-backdrop orders-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section aria-labelledby="orders-title" aria-modal="true" className="site-modal orders-modal" role="dialog">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">{admin ? "ORDER MANAGEMENT" : "YOUR FRESH ORDERS"}</span>
            <h2 id="orders-title">{admin ? "Admin dashboard" : "My orders"}</h2>
          </div>
          <div className="orders-actions">
            <button aria-label="Refresh orders" className="icon-button" onClick={refreshOrders} type="button"><RefreshCw size={17} /></button>
            {onSignOut && <button aria-label="Sign out" className="icon-button" onClick={onSignOut} type="button"><LogOut size={17} /></button>}
            <button aria-label="Close orders" className="icon-button" onClick={onClose} type="button"><X /></button>
          </div>
        </div>
        {!admin && (
          <div className="account-profile">
            {user.avatarData ? (
              <img alt={`${user.name} profile`} className="profile-photo" src={user.avatarData} />
            ) : (
              <span aria-label={`${user.name} profile initials`} className="profile-photo profile-initials">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="profile-copy"><strong>{user.name}</strong><small>{user.email}</small></div>
            <label className="avatar-upload-button">
              {photoBusy ? "Saving…" : user.avatarData ? "Change photo" : "Add photo"}
              <input accept="image/jpeg,image/png,image/webp" disabled={photoBusy} onChange={updateProfilePhoto} type="file" />
            </label>
            {user.avatarData && <button className="avatar-remove-button" disabled={photoBusy} onClick={removeProfilePhoto} type="button">Remove</button>}
            {photoError && <p className="form-error profile-photo-error" role="alert">{photoError}</p>}
          </div>
        )}
        {admin && (
          <>
            <div className="dashboard-stats">
              <div><span>ACTIVE ORDERS</span><strong>{orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length}</strong></div>
              <div><span>OUT FOR DELIVERY</span><strong>{orders.filter((order) => order.status === "out_for_delivery").length}</strong></div>
              <div><span>DELIVERED</span><strong>{orders.filter((order) => order.status === "delivered").length}</strong></div>
            </div>
            <div aria-label="Sales reports" className="dashboard-periods">
              {dashboardPeriods.map((summary) => (
                <article className="period-report" key={summary.period}>
                  <span>{summary.period.toUpperCase()}</span>
                  <strong>₹{summary.revenue.toLocaleString("en-IN")}</strong>
                  <small>{summary.orderCount} orders · {summary.deliveredCount} delivered · {summary.cancelledCount} cancelled</small>
                </article>
              ))}
            </div>
            <section className="coverage-management">
              <div>
                <span className="eyebrow">SERVICE AREA</span>
                <h3>Markapuram delivery coverage</h3>
                <p>Select the verified center on the map. The server uses this center and radius for checkout validation.</p>
              </div>
              <DeliveryLocationPicker
                center={coverage.center}
                description={`Select the reference point for the ${coverage.radiusKm} km service boundary. This circle previews the radius around the selected center.`}
                gettingLocation={false}
                heading="Verify the Markapur service center"
                onSelect={(center) => setCoverage((current) => ({ ...current, center }))}
                onUseCurrentLocation={useAdminCurrentLocation}
                radiusKm={coverage.radiusKm}
                selectedLocation={coverage.center}
              />
              <form className="coverage-settings-form" onSubmit={saveCoverage}>
                <label>Verified reference address
                  <input defaultValue={coverage.referencePoint || ""} key={coverage.referencePoint} maxLength="160" name="referencePoint" required />
                </label>
                <div className="form-two-columns">
                  <label>Center latitude
                    <input readOnly value={coverage.center.latitude.toFixed(6)} />
                  </label>
                  <label>Center longitude
                    <input readOnly value={coverage.center.longitude.toFixed(6)} />
                  </label>
                </div>
                <label>Service radius (km)
                  <input defaultValue={coverage.radiusKm} key={`radius-${coverage.radiusKm}`} max="100" min="0.1" name="radiusKm" required step="0.1" type="number" />
                </label>
                <label className="terms-choice">
                  <input defaultChecked={coverage.enabled} key={`enabled-${coverage.enabled}`} name="enabled" type="checkbox" />
                  <span>Enable delivery coverage</span>
                </label>
                <button className="button button-green" disabled={coverageBusy} type="submit">
                  {coverageBusy ? "Saving…" : "Save service area"}
                </button>
              </form>
            </section>
          </>
        )}
        <div aria-live="polite" className="orders-list">
          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p className="orders-notice" role="status">{notice}</p>}
          {!error && orders.length === 0 && (
            <div className="orders-empty">
              <span className="empty-bag-icon"><PackageCheck /></span>
              <h3>No orders yet</h3>
              <p>{admin ? "New customer orders will appear here." : "Your placed orders and delivery updates will appear here."}</p>
            </div>
          )}
          {orders.map((order) => {
            const stepIndex = orderSteps.findIndex(([status]) => status === order.status);
            return (
              <article className="order-card" key={order.id}>
                <div className="order-card-heading">
                  <div><span className="order-id">ORDER {order.id}</span><h3>₹{order.total} <span>· {order.items.reduce((sum, item) => sum + item.quantity, 0)} box(es)</span></h3></div>
                  <span className={`order-status status-${order.status}`}>{orderStatusLabels[order.status]}</span>
                </div>
                {admin && <div className="admin-customer"><strong>{order.customer.name}</strong> · {order.customer.phone} · {order.customer.email}</div>}
                <div className="order-item-list">
                  {order.items.map((item) => <span key={item.productId}>{item.name} × {item.quantity} <b>₹{item.lineTotal}</b></span>)}
                </div>
                <p className="order-address">
                  {order.address.line1 || "House/street not recorded"}
                  {order.address.area ? `, ${order.address.area}` : ""}
                  {order.address.city ? `, ${order.address.city}` : ""}
                  {order.address.pincode ? ` ${order.address.pincode}` : ""}
                  {order.address.landmark ? ` · Near ${order.address.landmark}` : ""}
                </p>
                <p className={`order-address-verification ${order.address.verificationStatus === "unverified" || !order.address.verificationStatus ? "unverified" : "verified"}`}>
                  {order.address.verificationStatus === "admin-verified"
                    ? "Address reviewed by admin"
                    : order.address.verificationStatus === "osm-verified"
                      ? "OpenStreetMap place match"
                      : "Unverified delivery pin"}
                </p>
                {order.address.osmDisplayName && <small className="order-osm-address">OpenStreetMap result: {order.address.osmDisplayName}</small>}
                {order.address.instructions && <p className="order-delivery-instructions">Delivery instructions: {order.address.instructions}</p>}
                {admin && (
                  <>
                    <button
                      className="button button-light admin-address-review-toggle"
                      onClick={() => setEditingAddressOrderId(editingAddressOrderId === order.id ? "" : order.id)}
                      type="button"
                    >
                      {editingAddressOrderId === order.id ? "Close address review" : "Review / correct delivery address"}
                    </button>
                    {editingAddressOrderId === order.id && (
                      <form className="admin-address-review" onSubmit={(event) => void saveOrderAddress(order, event)}>
                        <strong>Review delivery address and exact pin coordinates</strong>
                        <label>House number / street
                          <input defaultValue={order.address.line1 || ""} maxLength="160" name="line1" />
                        </label>
                        <div className="form-two-columns">
                          <label>Area / locality
                            <input defaultValue={order.address.area || ""} maxLength="100" minLength="2" name="area" required />
                          </label>
                          <label>PIN code (optional)
                            <input defaultValue={order.address.pincode || ""} inputMode="numeric" maxLength="6" name="pincode" pattern="[0-9]{6}" />
                          </label>
                        </div>
                        <label>Nearby landmark
                          <input defaultValue={order.address.landmark || ""} maxLength="120" name="landmark" />
                        </label>
                        <label>Delivery instructions
                          <input defaultValue={order.address.instructions || ""} maxLength="300" name="instructions" />
                        </label>
                        <div className="form-two-columns">
                          <label>Latitude
                            <input defaultValue={order.address.latitude} max="90" min="-90" name="latitude" required step="any" type="number" />
                          </label>
                          <label>Longitude
                            <input defaultValue={order.address.longitude} max="180" min="-180" name="longitude" required step="any" type="number" />
                          </label>
                        </div>
                        <label className="terms-choice">
                          <input defaultChecked={order.address.verificationStatus === "admin-verified"} name="markVerified" type="checkbox" />
                          <span>Mark this corrected address as reviewed by admin</span>
                        </label>
                        <button className="button button-green" disabled={addressSaving} type="submit">
                          {addressSaving ? "Saving address…" : "Save address correction"}
                        </button>
                      </form>
                    )}
                  </>
                )}
                {Number.isFinite(order.address.latitude) && Number.isFinite(order.address.longitude) && (
                  <a
                    className="order-map-link"
                    href={mapsDirectionsUrl(order.address.latitude, order.address.longitude)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <MapPin size={14} /> {admin ? "Open delivery location in Google Maps" : "View delivery location on Google Maps"}
                  </a>
                )}
                <p className="order-payment">{order.paymentMethod === "cod" ? "Cash on delivery" : "Confirm on WhatsApp"} · Free delivery</p>
                {order.paymentMethod === "whatsapp" && order.status === "awaiting_confirmation" && (
                  <WhatsAppLink
                    className="order-whatsapp-link"
                    message={`Hello Froot Bowl Markapur! Please confirm my order ${order.id} for ₹${order.total}.\nDelivery: ${order.address.line1}, ${order.address.area}, Markapur ${order.address.pincode}.\nThank you!`}
                  >
                    <MessageCircle size={14} /> Message the shop to confirm
                  </WhatsAppLink>
                )}
                {!admin && ["placed", "awaiting_confirmation", "confirmed"].includes(order.status) && (
                  <button className="cancel-order-button" disabled={busyOrder === order.id} onClick={() => setConfirmation({ type: "cancel", order })} type="button">
                    {busyOrder === order.id ? "Cancelling…" : "Cancel order"}
                  </button>
                )}
                <div className="order-timeline">
                  {order.status === "awaiting_confirmation" ? (
                    <div className="timeline-awaiting"><Clock3 size={16} /> Waiting for Froot Bowl to confirm this order.</div>
                  ) : order.status === "cancelled" ? (
                    <div className="timeline-awaiting"><X size={16} /> This order was cancelled.</div>
                  ) : (
                    orderSteps.map(([status, label], index) => {
                      const complete = stepIndex >= index;
                      const current = stepIndex === index;
                      return (
                        <div className={complete ? "timeline-step complete" : "timeline-step"} key={status}>
                          <span className="timeline-dot">{complete ? <Check size={11} /> : index + 1}</span>
                          <span>{label}</span>
                          {current && <b>Current</b>}
                        </div>
                      );
                    })
                  )}
                </div>
                {admin && (
                  <div className="admin-order-actions">
                    {order.status !== "delivered" && order.status !== "cancelled" && (
                      <>
                        <label>Update status
                          <select
                            disabled={busyOrder === order.id}
                            onChange={(event) => updateStatus(order, event.target.value)}
                            value={order.status}
                          >
                            <option value="awaiting_confirmation">Awaiting confirmation</option>
                            <option value="placed">Order received</option>
                            <option value="confirmed">Order confirmed</option>
                            <option value="preparing">Being prepared</option>
                            <option value="out_for_delivery">Out for delivery</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </label>
                      </>
                    )}
                    {order.status === "delivered" && (
                      <button className="delete-delivered" disabled={busyOrder === order.id} onClick={() => setConfirmation({ type: "delete", order })} type="button">
                        <Trash2 size={14} /> Delete delivered order
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
        <p className="tracking-disclaimer"><MapPin size={14} /> Froot Bowl manages the order and delivery status updates.</p>
      </section>
      {confirmation && (
        <div
          className="modal-backdrop confirmation-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConfirmation(null);
          }}
        >
          <section
            aria-labelledby="confirmation-title"
            aria-modal="true"
            className="site-modal confirmation-modal"
            role="alertdialog"
          >
            <span className="confirmation-mark">{confirmation.type === "cancel" ? <X /> : <Trash2 />}</span>
            <span className="eyebrow">{confirmation.type === "cancel" ? "ORDER UPDATE" : "ADMIN ACTION"}</span>
            <h2 id="confirmation-title">
              {confirmation.type === "cancel" ? "Cancel this order?" : "Delete this delivered order?"}
            </h2>
            <p>
              {confirmation.type === "cancel"
                ? `Order ${confirmation.order.id} will be cancelled. This action can’t be undone. Your account will be blocked after the fourth cancelled order.`
                : `Order ${confirmation.order.id} will be permanently removed from the order history. This action can’t be undone.`}
            </p>
            <div className="confirmation-actions">
              <button className="button button-light" onClick={() => setConfirmation(null)} type="button">
                Keep order
              </button>
              <button
                className="button confirmation-danger"
                onClick={() => {
                  const { order, type } = confirmation;
                  setConfirmation(null);
                  if (type === "cancel") void cancelOrder(order);
                  else void deleteOrder(order);
                }}
                type="button"
              >
                {confirmation.type === "cancel" ? "Cancel order" : "Delete order"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function RiderCustomerDetailsEditor({ order, onClose, onSaved }) {
  const [values, setValues] = useState({
    name: order.customer.name,
    phone: order.customer.phone,
    line1: order.address.line1,
    area: order.address.area,
    city: order.address.city,
    pincode: order.address.pincode,
    landmark: order.address.landmark,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest(`/api/rider/orders/${order.id}/customer-details`, {
        method: "PATCH",
        body: JSON.stringify({
          customer: { name: values.name, phone: values.phone },
          address: {
            line1: values.line1,
            area: values.area,
            city: values.city,
            pincode: values.pincode,
            landmark: values.landmark,
          },
        }),
      });
      await onSaved(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop rider-edit-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section aria-labelledby="rider-edit-title" aria-modal="true" className="site-modal rider-edit-modal" role="dialog">
        <div className="modal-heading">
          <div><span className="eyebrow">ORDER {order.id}</span><h2 id="rider-edit-title">Update recipient details</h2></div>
          <button aria-label="Close edit customer details" className="icon-button" onClick={onClose} type="button"><X /></button>
        </div>
        <p className="rider-edit-note">Changes apply to this order only. The saved map pin stays where it is; if the drop-off point changed, contact the shop to update the pin. Address edits require fresh GPS and delivery photos.</p>
        <form className="dialog-form rider-edit-form" onSubmit={save}>
          <label>Customer name<input autoComplete="name" maxLength="80" name="name" onChange={updateField} required value={values.name} /></label>
          <label>Phone number<input autoComplete="tel" maxLength="20" name="phone" onChange={updateField} required value={values.phone} /></label>
          <label>House number / street<input autoComplete="street-address" maxLength="160" minLength="8" name="line1" onChange={updateField} required value={values.line1} /></label>
          <div className="form-two-columns">
            <label>Area / locality<input maxLength="100" minLength="2" name="area" onChange={updateField} required value={values.area} /></label>
            <label>City<input maxLength="80" name="city" readOnly required value="Markapur" /></label>
          </div>
          <div className="form-two-columns">
            <label>PIN code<input autoComplete="postal-code" inputMode="numeric" maxLength="6" name="pincode" onChange={updateField} pattern="[0-9]{6}" required value={values.pincode} /></label>
            <label>Landmark<input maxLength="120" minLength="3" name="landmark" onChange={updateField} required value={values.landmark} /></label>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="confirmation-actions">
            <button className="button button-light" disabled={busy} onClick={onClose} type="button">Cancel</button>
            <button className="button button-green" disabled={busy} type="submit">{busy ? "Saving…" : "Save order details"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function RiderPortal({ user, onSignOut }) {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [locationStatus, setLocationStatus] = useState("");
  const [confirmRadius, setConfirmRadius] = useState(100);
  const [busyPhoto, setBusyPhoto] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [busyOverrideOrder, setBusyOverrideOrder] = useState("");
  const [editingOrder, setEditingOrder] = useState(null);
  const [cameraTarget, setCameraTarget] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const cameraVideoRef = useRef(null);
  const lastLocationSentAt = useRef(0);
  const activeOrderIds = orders
    .filter((order) => order.status === "out_for_delivery")
    .map((order) => order.id)
    .join(",");

  async function refreshOrders() {
    try {
      const result = await apiRequest("/api/orders");
      setOrders(result.orders);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => {
    refreshOrders();
    const timer = window.setInterval(refreshOrders, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    apiRequest("/api/config")
      .then((config) => setConfirmRadius(config.deliveryConfirmRadiusMeters))
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => {
    if (sharing && !activeOrderIds) {
      setSharing(false);
      setLocationStatus("Location sharing stopped because there are no active deliveries.");
    }
  }, [sharing, activeOrderIds]);

  useEffect(() => {
    if (!sharing || !activeOrderIds || !navigator.geolocation) return undefined;
    const watchId = navigator.geolocation.watchPosition(
      async ({ coords }) => {
        if (Date.now() - lastLocationSentAt.current < 5000) return;
        lastLocationSentAt.current = Date.now();
        const payload = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          heading: coords.heading,
        };
        try {
          await Promise.all(activeOrderIds.split(",").map((orderId) =>
            apiRequest(`/api/rider/orders/${orderId}/location`, {
              method: "POST",
              body: JSON.stringify(payload),
            }),
          ));
          setLocationStatus(`Live location shared · GPS accuracy ±${Math.round(coords.accuracy)} m`);
          setError("");
        } catch (requestError) {
          setError(requestError.message);
        }
      },
      (locationError) => {
        setLocationStatus("");
        setError(
          locationError.code === locationError.PERMISSION_DENIED
            ? "Location permission is required to share a rider position."
            : "The device could not get an accurate location. Check GPS and try again.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [sharing, activeOrderIds]);

  useEffect(() => {
    if (!cameraTarget) return undefined;
    let cancelled = false;
    let stream;
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not supported in this browser. Open the rider page on a device with a camera.");
      return undefined;
    }
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    }).then((camera) => {
      if (cancelled) {
        camera.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = camera;
      setCameraStream(camera);
    }).catch(() => {
      setCameraError("Camera permission was denied or no camera is available. Allow camera access and try again.");
    });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    };
  }, [cameraTarget]);

  useEffect(() => {
    if (!cameraStream || !cameraVideoRef.current) return undefined;
    const video = cameraVideoRef.current;
    video.srcObject = cameraStream;
    video.play().catch(() => {
      setCameraError("The camera preview could not start. Check camera permission and try again.");
    });
    return () => {
      video.srcObject = null;
    };
  }, [cameraStream]);

  async function uploadDeliveryPhoto(order, index, file) {
    if (!file) return false;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setError("Choose an image smaller than 10 MB.");
      return false;
    }
    setBusyPhoto(`${order.id}-${index}`);
    setError("");
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 960 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your browser couldn’t prepare this photo.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      let imageData = canvas.toDataURL("image/jpeg", 0.72);
      for (const quality of [0.58, 0.45, 0.32]) {
        if (imageData.length <= 270_000) break;
        imageData = canvas.toDataURL("image/jpeg", quality);
      }
      if (imageData.length > 270_000) {
        throw new Error("This photo is too large. Please retake it in a smaller size.");
      }
      await apiRequest(`/api/rider/orders/${order.id}/proofs/${index + 1}`, {
        method: "PUT",
        body: JSON.stringify({ imageData }),
      });
      await refreshOrders();
      return true;
    } catch (photoError) {
      setError(photoError.message);
      return false;
    } finally {
      setBusyPhoto("");
    }
  }

  async function captureDeliveryPhoto() {
    if (!cameraTarget || !cameraVideoRef.current?.videoWidth) {
      setCameraError("The camera is not ready yet. Wait for the preview and try again.");
      return;
    }
    const video = cameraVideoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("This browser could not capture the camera image.");
      return;
    }
    context.drawImage(video, 0, 0);
    const image = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (!image) {
      setCameraError("The camera photo could not be prepared. Please retake it.");
      return;
    }
    const { order, index } = cameraTarget;
    const uploaded = await uploadDeliveryPhoto(order, index, new File([image], `delivery-${index + 1}.jpg`, { type: "image/jpeg" }));
    if (uploaded) setCameraTarget(null);
  }

  async function verifyLocationApprovalCode(order, event) {
    event.preventDefault();
    setBusyOverrideOrder(order.id);
    setError("");
    setLocationStatus("");
    try {
      const result = await apiRequest(`/api/rider/orders/${order.id}/location-override`, {
        method: "POST",
        body: JSON.stringify({ code: locationCode }),
      });
      setLocationCode("");
      setLocationStatus(result.message);
      await refreshOrders();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyOverrideOrder("");
    }
  }

  async function prepareRiderLocationCode(order) {
    setBusyOverrideOrder(order.id);
    setError("");
    setLocationStatus("");
    setLocationCodeLinks((links) => {
      const nextLinks = { ...links };
      delete nextLinks[order.id];
      return nextLinks;
    });
    try {
      const result = await apiRequest(`/api/rider/orders/${order.id}/location-override-code`, {
        method: "POST",
      });
      setLocationStatus(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyOverrideOrder("");
    }
  }

  const activeOrders = orders.filter((order) => order.status === "out_for_delivery");
  const otherOrders = orders.filter((order) => order.status !== "out_for_delivery");
  return (
    <div className="admin-page rider-page">
      <header className="admin-page-header">
        <a aria-label="Froot Bowl customer shop" className="brand" href="/">
          <img alt="" src="/assets/froot-bowl-logo.jpeg" />
          <span className="brand-copy"><strong>Froot Bowl</strong><small>MARKAPUR</small></span>
        </a>
        <span className="admin-private-label"><Truck size={16} /> RIDER PORTAL</span>
        <div className="rider-header-actions">
          <span>{user.name}</span>
          <button aria-label="Sign out" className="icon-button" onClick={onSignOut} type="button"><LogOut size={17} /></button>
        </div>
      </header>
      <main className="rider-dashboard">
        <div className="rider-dashboard-heading">
          <div><span className="eyebrow">FROOT BOWL · MARKAPUR</span><h1>Your deliveries</h1></div>
          {sharing ? (
            <button className="button button-light" onClick={() => { setSharing(false); setLocationStatus("Live location sharing has stopped."); }} type="button">
              Stop sharing
            </button>
          ) : (
            <button className="button button-green" disabled={!activeOrders.length} onClick={() => {
              if (!navigator.geolocation) {
                setError("Location sharing is not supported by this browser.");
                return;
              }
              setError("");
              setSharing(true);
            }} type="button">
              <LocateFixed size={16} /> Start live location
            </button>
          )}
        </div>
        <p className="rider-privacy-note">Your location is shared with the customer and Froot Bowl only while you have active deliveries and live sharing is enabled.</p>
        {locationStatus && <p className="rider-location-status" role="status">{locationStatus}</p>}
        {error && <p className="form-error rider-error" role="alert">{error}</p>}
        {activeOrders.length === 0 && <div className="rider-empty">No active deliveries are assigned to you right now.</div>}
        {activeOrders.map((order) => {
          const distance = order.trackingLocation
            ? distanceMeters(order.address, order.trackingLocation)
            : null;
          const atCustomerLocation = distance !== null && distance <= confirmRadius;
          return (
          <article className="rider-order-card" key={order.id}>
            <div className="rider-order-heading"><div><span className="order-id">ORDER {order.id}</span><h2>Deliver to {order.customer.name}</h2></div><span className="order-status status-out_for_delivery">Out for delivery</span></div>
            <p className="order-address">{order.address.line1}, {order.address.area}, {order.address.city} {order.address.pincode}{order.address.landmark ? ` · Near ${order.address.landmark}` : ""}</p>
            <div className="rider-customer-actions">
              <a className="order-map-link" href={mapsDirectionsUrl(order.address.latitude, order.address.longitude)} rel="noreferrer" target="_blank"><MapPin size={14} /> Navigate to customer</a>
              <a className="call-customer-button rider-call-button" href={phoneLink(order.customer.phone)}><Phone size={14} /> Call customer</a>
              <button className="rider-edit-customer-button" onClick={() => setEditingOrder(order)} type="button"><UserRound size={14} /> Edit customer details</button>
            </div>
            {order.trackingLocation && <GoogleTrackingMap destination={order.address} rider={order.trackingLocation} />}
            <p className={atCustomerLocation ? "rider-arrival-status arrived" : "rider-arrival-status"}>
              {distance === null
                ? "Waiting for live GPS before capturing proof."
                : atCustomerLocation
                  ? `At customer location · approximately ${Math.round(distance)} m from the saved pin.`
                  : `Move closer to the customer location · approximately ${Math.round(distance)} m away (limit ${confirmRadius} m).`}
            </p>
            <section className="rider-proof-section">
              <h3><Camera size={16} /> Delivery photos ({order.deliveryProofCount}/3)</h3>
              <p>Take three clear photos of the order/package only. Do not photograph customer faces.</p>
              {order.deliveryProofCount === 3 ? (
                <p className="customer-confirmation-pending">Photos saved. The customer must confirm receipt from the delivery address to complete this order.</p>
              ) : order.deliveryPhotoOverrideActive ? (
                <p className="customer-confirmation-pending">Customer approval verified. Photo capture outside the delivery area is enabled temporarily. Receipt confirmation is still required.</p>
              ) : distance !== null && !atCustomerLocation && (
                <div className="rider-location-code-form">
                  <p>You are outside the saved delivery area. Send a one-time approval code to the customer on WhatsApp. Once they share it back, enter it below to unlock photo capture.</p>
                  <button
                    className="button button-green"
                    disabled={busyOverrideOrder === order.id}
                    onClick={() => prepareRiderLocationCode(order)}
                    type="button"
                  >
                    <MessageCircle size={14} /> {busyOverrideOrder === order.id ? "Sending code…" : "Send approval code to customer"}
                  </button>
                  <form onSubmit={(event) => verifyLocationApprovalCode(order, event)}>
                  <label htmlFor={`location-code-${order.id}`}>Customer approval code</label>
                  <div>
                    <input
                      autoComplete="one-time-code"
                      id={`location-code-${order.id}`}
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(event) => setLocationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      pattern="[0-9]{6}"
                      placeholder="6-digit code"
                      required
                      value={locationCode}
                    />
                    <button className="button button-green" disabled={busyOverrideOrder === order.id || locationCode.length !== 6} type="submit">
                      {busyOverrideOrder === order.id ? "Checking…" : "Verify code"}
                    </button>
                  </div>
                  </form>
                </div>
              )}
              <div className="rider-photo-slots">
                {[0, 1, 2].map((index) => {
                  const photoBusy = busyPhoto === `${order.id}-${index}`;
                  const canCapture =
                    order.deliveryProofCount < 3 &&
                    sharing &&
                    (atCustomerLocation || order.deliveryPhotoOverrideActive) &&
                    !order.deliveryProofSlots?.[index];
                  return (
                    <button
                      className={order.deliveryProofSlots?.[index] ? "rider-photo-slot uploaded" : "rider-photo-slot"}
                      disabled={!canCapture || photoBusy}
                      key={index}
                      onClick={() => {
                        setCameraError("");
                        setCameraTarget({ order, index });
                      }}
                      type="button"
                    >
                      <Camera size={18} />
                      <span>Photo {index + 1}{order.deliveryProofSlots?.[index] ? " · saved" : ""}</span>
                      {photoBusy && <small>Uploading…</small>}
                    </button>
                  );
                })}
              </div>
            </section>
          </article>
          );
        })}
        {otherOrders.length > 0 && (
          <details className="rider-history">
            <summary>Previous deliveries ({otherOrders.length})</summary>
            {otherOrders.map((order) => <p key={order.id}>{order.id} · {orderStatusLabels[order.status]}</p>)}
          </details>
        )}
      </main>
      {cameraTarget && (
        <div className="modal-backdrop rider-camera-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setCameraTarget(null);
        }}>
          <section aria-labelledby="rider-camera-title" aria-modal="true" className="site-modal rider-camera-modal" role="dialog">
            <div className="modal-heading">
              <div><span className="eyebrow">ORDER {cameraTarget.order.id}</span><h2 id="rider-camera-title">Take delivery photo {cameraTarget.index + 1}</h2></div>
              <button aria-label="Close camera" className="icon-button" onClick={() => setCameraTarget(null)} type="button"><X /></button>
            </div>
            <p className="rider-camera-note">Take a clear photo of the order or package only. Do not photograph customer faces.</p>
            {cameraError ? (
              <p className="form-error" role="alert">{cameraError}</p>
            ) : (
              <video aria-label="Live camera preview" autoPlay className="rider-camera-preview" playsInline ref={cameraVideoRef} />
            )}
            <div className="confirmation-actions">
              <button className="button button-light" onClick={() => setCameraTarget(null)} type="button">Cancel</button>
              <button
                className="button button-green"
                disabled={!cameraStream || Boolean(cameraError) || busyPhoto === `${cameraTarget.order.id}-${cameraTarget.index}`}
                onClick={captureDeliveryPhoto}
                type="button"
              >
                <Camera size={16} /> {busyPhoto === `${cameraTarget.order.id}-${cameraTarget.index}` ? "Uploading…" : "Capture and upload"}
              </button>
            </div>
          </section>
        </div>
      )}
      {editingOrder && (
        <RiderCustomerDetailsEditor
          onClose={() => setEditingOrder(null)}
          onSaved={async (result) => {
            setEditingOrder(null);
            setLocationStatus(result.message);
            await refreshOrders();
          }}
          order={editingOrder}
        />
      )}
    </div>
  );
}

function App() {
  const adminRoute = window.location.pathname === "/admin";
  const removedRiderRoute = window.location.pathname === "/rider";
  const [cart, setCart] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("froot-bowl-cart") || "[]");
      return Array.isArray(saved)
        ? saved.filter((item) => ["small-fruit-box", "regular-fruit-box"].includes(item.id))
        : [];
    } catch (error) {
      console.error("Unable to restore saved bag:", error);
      return [];
    }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [menu, setMenu] = useState({ products: [], categories: [] });
  const [menuStatus, setMenuStatus] = useState("loading");
  const [menuVersion, setMenuVersion] = useState(0);
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(adminRoute);
  const [authPurpose, setAuthPurpose] = useState(adminRoute ? "admin" : "account");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [checkoutRequestId, setCheckoutRequestId] = useState(() => crypto.randomUUID());
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);

  useEffect(() => {
    if (removedRiderRoute) window.location.replace("/");
  }, [removedRiderRoute]);

  useEffect(() => {
    apiRequest("/api/auth/me")
      .then((result) => {
        if (result.user.role === "rider") {
          return apiRequest("/api/auth/logout", { method: "POST" });
        }
        setUser(result.user);
        if (adminRoute && result.user.role === "admin") {
          setAuthOpen(false);
          setAdminOpen(true);
        }
      })
      .catch((error) => {
        if (!["Please sign in.", "Please sign in to continue."].includes(error.message)) {
          console.error("Unable to restore the sign-in session:", error);
        }
      });
  }, [adminRoute]);

  useEffect(() => {
    let active = true;
    setMenuStatus("loading");

    fetch("/api/menu")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Menu request failed (${response.status})`);
        }
        return response.json();
      })
      .then((data) => {
        if (!Array.isArray(data.products) || !Array.isArray(data.categories)) {
          throw new Error("The menu response has an unexpected format.");
        }
        if (active) {
          setMenu(data);
          setMenuStatus("ready");
        }
      })
      .catch((error) => {
        console.error("Unable to load menu from backend:", error);
        if (active) setMenuStatus("error");
      });

    return () => {
      active = false;
    };
  }, [menuVersion]);

  useEffect(() => {
    localStorage.setItem("froot-bowl-cart", JSON.stringify(cart));
  }, [cart]);

  function addToCart(product) {
    setCart((items) => {
      const existing = items.find(
        (item) => item.id === product.id && JSON.stringify(item.customization) === JSON.stringify(product.customization),
      );
      if (existing) {
        return items.map((item) =>
          item === existing ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...items, { ...product, quantity: 1 }];
    });
  }

  function changeQuantity(id, amount) {
    setCart((items) =>
      items
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity + amount } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function handleAccountOpen() {
    if (user?.role === "admin") setAdminOpen(true);
    else if (user) setOrdersOpen(true);
    else {
      setAuthPurpose("account");
      setAuthOpen(true);
    }
  }

  function handleAuthSuccess(authenticatedUser) {
    setUser(authenticatedUser);
    setAuthOpen(false);
    if (authenticatedUser.role === "admin") setAdminOpen(true);
    else if (authPurpose === "checkout") setCheckoutOpen(true);
    else setOrdersOpen(true);
  }

  function handleCheckout() {
    setCartOpen(false);
    if (user?.role !== "customer") {
      setAuthPurpose("checkout");
      setAuthOpen(true);
      return;
    }
    setCheckoutOpen(true);
  }

  async function handlePlaceOrder(orderDetails) {
    const result = await apiRequest("/api/orders", {
      method: "POST",
      body: JSON.stringify(orderDetails),
      headers: { "Idempotency-Key": checkoutRequestId },
    });
    setCheckoutRequestId(crypto.randomUUID());
    setCart([]);
    setCheckoutOpen(false);
    setOrdersOpen(true);
    return result.order;
  }

  async function handleSignOut() {
    await apiRequest("/api/auth/logout", { method: "POST" });
    setUser(null);
    setOrdersOpen(false);
    setAdminOpen(false);
    if (adminRoute) setAuthOpen(true);
  }

  function enquireAboutBowl(name, choices) {
    openWhatsApp(
      `Hello Froot Bowl Markapur!\n\nI'd like to enquire about a custom ${name}.\nMy fruit choices: ${choices.join(", ")}.\n\nPlease confirm today's availability and price. Thank you!`,
    );
  }

  function sendContactForm(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = form.get("name");
    const phone = form.get("phone");
    const topic = form.get("topic");
    const message = form.get("message");
    openWhatsApp(
      `Hello Froot Bowl Markapur!\n\nMy name is ${name}.\nMy phone number is ${phone}.\nEnquiry: ${topic}\n\n${message}\n\nPlease get back to me. Thank you!`,
    );
    event.currentTarget.reset();
  }

  if (adminRoute) {
    return (
      <div className="admin-page">
        <header className="admin-page-header">
          <a aria-label="Froot Bowl customer shop" className="brand" href="/">
            <img alt="" src="/assets/froot-bowl-logo.jpeg" />
            <span className="brand-copy"><strong>Froot Bowl</strong><small>MARKAPUR</small></span>
          </a>
          <span className="admin-private-label"><ShieldCheck size={16} /> PRIVATE STAFF PORTAL</span>
          <a className="admin-store-link" href="/">Customer shop <ArrowUpRight size={15} /></a>
        </header>
        <main className="admin-page-main">
          <span className="eyebrow">FROOT BOWL · MARKAPUR</span>
          <h1>Order management</h1>
          <p>Manage incoming customer orders and keep delivery updates current.</p>
          {!adminOpen && (
            <button
              className="button button-green"
              onClick={() => user?.role === "admin" ? setAdminOpen(true) : setAuthOpen(true)}
              type="button"
            >
              {user?.role === "admin" ? "Open dashboard" : "Admin sign in"} <ArrowRight size={16} />
            </button>
          )}
        </main>
        {authOpen && (
          <AuthDialog
            initialAdmin
            onClose={() => setAuthOpen(false)}
            onSignedIn={handleAuthSuccess}
            purpose="admin"
          />
        )}
        {adminOpen && user?.role === "admin" && (
          <OrdersDialog admin onClose={() => setAdminOpen(false)} onSignOut={handleSignOut} />
        )}
      </div>
    );
  }

  return (
    <>
      <div className="announcement-bar">
        <span><Truck size={15} /> Free home delivery</span>
        <i />
        <span>Proudly serving Markapur</span>
        <a href={`https://wa.me/${WHATSAPP_NUMBER}`}>Order on WhatsApp <ArrowUpRight size={13} /></a>
      </div>
      <Header
        cartCount={cartCount}
        onAccount={handleAccountOpen}
        onAdmin={() => setAdminOpen(true)}
        onCartOpen={() => setCartOpen(true)}
        user={user}
      />

      <main>
        <section className="hero" id="home">
          <div className="hero-background-shape shape-one" />
          <div className="hero-background-shape shape-two" />
          <div className="hero-content">
            <div className="hero-kicker"><span className="kicker-line" /> FRESHNESS IN EVERY BOWL</div>
            <h1>Good days<br />start <em>fresh.</em></h1>
            <p className="hero-description">
              Fresh fruits, feel-good bowls, and healthy choices made for your day. Prepared with care and proudly serving Markapur.
            </p>
            <div className="hero-buttons">
              <a className="button button-green" href="#menu">
                Explore our picks <ArrowRight size={17} />
              </a>
              <WhatsAppLink
                className="button button-light"
                message="Hello Froot Bowl Markapur! I'd love to know what's fresh and available today. Please share the menu and prices. Thank you!"
              >
                <MessageCircle size={17} /> Order on WhatsApp
              </WhatsAppLink>
            </div>
            <div className="hero-proof">
              <div className="proof-avatars" aria-hidden="true">
                <span>F</span><span>+</span><span>♡</span>
              </div>
              <p><strong>Fresh fruit, your way.</strong><br />Local goodness, delivered with care.</p>
            </div>
            <a className="scroll-cue" href="#categories"><ArrowDown size={15} /> SCROLL TO EXPLORE</a>
          </div>
          <div className="hero-visual">
            <div className="hero-photo-frame">
              <FoodImage
                alt="A colorful bowl of fresh fruit"
                fetchpriority="high"
                src="https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?auto=format&fit=crop&w=1400&q=90"
              />
            </div>
            <div className="hero-photo-overlay" />
            <div className="floating-card freshness-card">
              <span className="floating-icon"><Leaf size={19} /></span>
              <span><strong>Freshness</strong><small>in every bowl</small></span>
            </div>
            <div className="floating-card delivery-card">
              <span className="delivery-icon"><Truck size={18} /></span>
              <span><strong>Free delivery</strong><small>around Markapur</small></span>
            </div>
            <div className="hero-image-caption">A little color for your everyday.</div>
          </div>
          <div className="hero-bottom-line"><span>FROOT BOWL MARKAPUR</span><span>FRESH • HEALTHY • DELICIOUS</span></div>
        </section>

        <section className="benefit-strip" aria-label="Our promise">
          <div><span className="benefit-icon"><Leaf /></span><span><strong>Fresh fruit</strong><small>Picked for a fresh bite</small></span></div>
          <div><span className="benefit-icon"><Heart /></span><span><strong>Healthy choices</strong><small>Make it your kind of bowl</small></span></div>
          <div><span className="benefit-icon"><MapPin /></span><span><strong>Markapur, made local</strong><small>Proudly serving our community</small></span></div>
          <div><span className="benefit-icon"><Truck /></span><span><strong>Free home delivery</strong><small>A little freshness at your door</small></span></div>
        </section>

        <section className="section categories-section" id="categories">
          <div className="section-heading">
            <div>
              <span className="eyebrow">A FRESH PLACE TO START</span>
              <h2>What sounds <em>good?</em></h2>
            </div>
            <p>Have a craving in mind? Browse a few ideas, then message us to check what’s fresh and available today.</p>
          </div>
          <div className="category-grid">
            {menu.categories.map((category, index) => (
              <a className={`category-card category-${index + 1}`} href="#menu" key={category.name}>
                <FoodImage alt="" loading="lazy" src={category.image} />
                <div className="category-shade" />
                <div className="category-text">
                  <span className="category-index">0{index + 1} / FROOT BOWL</span>
                  <h3>{category.name}</h3>
                  <p>{category.detail}</p>
                  <span className="category-explore">Explore <ArrowUpRight size={15} /></span>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className="menu-section" id="menu">
          <div className="menu-decor decor-left">✳</div>
          <div className="section menu-inner">
            <div className="section-heading menu-heading">
              <div>
                <span className="eyebrow">A FEW FROOT BOWL IDEAS</span>
                <h2>Pick your <em>happy.</em></h2>
              </div>
              <div className="menu-heading-aside">
                <p>Menu inspiration to get you started. Ask us about today’s selection, availability, and prices.</p>
                <span className="availability-note"><span /> Availability changes with the season</span>
              </div>
            </div>
            {menuStatus === "loading" && <p className="menu-status">Loading fresh picks…</p>}
            {menuStatus === "error" && (
              <div className="menu-error" role="alert">
                <p>We couldn’t load the menu. Check that the backend is running, then try again.</p>
                <button className="text-link" onClick={() => setMenuVersion((version) => version + 1)} type="button">
                  Try again <ArrowRight size={15} />
                </button>
              </div>
            )}
            {menuStatus === "ready" && (
              <div className="product-grid">
                {menu.products.map((product) => (
                  <ProductCard key={product.id} onAdd={addToCart} product={product} />
                ))}
              </div>
            )}
            <div className="menu-bottom-cta">
              <span>Looking for something specific?</span>
              <WhatsAppLink
                className="text-link"
                message="Hello Froot Bowl Markapur! What fruit bowls or healthy choices are available today? Please share the menu and prices. Thank you!"
              >
                Ask us on WhatsApp <ArrowUpRight size={16} />
              </WhatsAppLink>
            </div>
          </div>
        </section>

        <section className="active-fruit-section">
          <div className="active-fruit-photo">
            <FoodImage
              alt="A person taking a break after a gym workout"
              loading="lazy"
              src="https://images.unsplash.com/photo-1534258936925-c58bed479fcb?auto=format&fit=crop&w=1000&q=85"
            />
            <span><Dumbbell size={15} /> A fresh break after your workout</span>
          </div>
          <div className="active-fruit-copy">
            <span className="eyebrow">FRESH FOR YOUR EVERYDAY</span>
            <h2>From gym time<br />to <em>fruit time.</em></h2>
            <p>Make a fresh mixed fruit box part of your day. Choose a small box for ₹59 or a regular box for ₹89, with free home delivery in Markapur.</p>
            <a className="text-link" href="#menu">Choose your fruit box <ArrowRight size={16} /></a>
          </div>
          <div className="active-fruit-detail">
            <FoodImage
              alt="A box of freshly cut mixed fruits"
              loading="lazy"
              src="https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=800&q=85"
            />
            <span>Fresh fruit, ready when you are.</span>
          </div>
        </section>

        <section className="monthly-section" id="monthly">
          <div className="monthly-photo">
            <FoodImage
              alt="Fresh fruit and healthy food ready for the week"
              loading="lazy"
              src="https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1000&q=85"
            />
            <span className="monthly-photo-badge"><RefreshCw size={16} /> A fresh routine</span>
          </div>
          <div className="monthly-copy">
            <span className="eyebrow">A LITTLE FRESHNESS, ALL MONTH</span>
            <h2>Monthly fruit<br /><em>packs are here.</em></h2>
            <p>Ask us about a monthly fruit box plan. We’ll help you choose the box size and delivery schedule that works for you.</p>
            <div className="monthly-points">
              <span><CheckCircle2 size={16} /> Fresh mixed fruit boxes</span>
              <span><CheckCircle2 size={16} /> Choose your schedule with us</span>
              <span><CheckCircle2 size={16} /> Delivery free in Markapur</span>
            </div>
            <WhatsAppLink
              className="button button-green"
              message="Hello Froot Bowl Markapur! I'm interested in a monthly fruit box pack. Please share available box sizes, delivery schedule, and monthly prices. Thank you!"
            >
              Enquire about monthly packs <ArrowUpRight size={17} />
            </WhatsAppLink>
            <small>Schedule and pricing are confirmed with us on WhatsApp.</small>
          </div>
        </section>

        <section className="section builder-section" id="build">
          <div className="section-heading builder-section-heading">
            <div>
              <span className="eyebrow">A BOWL THAT’S ALL YOU</span>
              <h2>Make it <em>your own.</em></h2>
            </div>
            <p>Start with the fruits you love. We’ll confirm what’s available and the price with you before we prepare anything.</p>
          </div>
          <BuildYourBowl onEnquire={enquireAboutBowl} />
        </section>

        <section className="story-section" id="story">
          <div className="story-visual">
            <FoodImage
              alt="Fresh fruit prepared for a colorful bowl"
              loading="lazy"
              src="https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=85"
            />
            <span className="story-stamp"><span>FRESH</span><span>•</span><span>LOCAL</span><span>•</span><span>FOR YOU</span></span>
            <div className="story-photo-label"><Leaf size={16} /> A fresh moment, made in Markapur</div>
          </div>
          <div className="story-copy">
            <span className="eyebrow">A LITTLE ABOUT US</span>
            <h2>Freshness in<br />every <em>bowl.</em></h2>
            <p>
              At Froot Bowl Markapur, we believe enjoying fruit should be simple, colorful, and delicious. We bring fresh fruit and healthy choices a little closer to your everyday.
            </p>
            <p>
              Whether you’re choosing a refreshing treat or putting together a bowl of your favorites, there’s something lovely about making room for fresh.
            </p>
            <div className="story-signoff"><span className="signoff-line" /> <span>With freshness, Froot Bowl Markapur</span></div>
            <a className="text-link" href="#contact">Come say hello <ArrowRight size={16} /></a>
          </div>
        </section>

        <section className="delivery-section">
          <div className="delivery-inner">
            <div className="delivery-art">
              <div className="delivery-ring"><Truck size={43} strokeWidth={1.2} /></div>
              <span className="delivery-spark spark-a">✳</span>
              <span className="delivery-spark spark-b">✳</span>
            </div>
            <div className="delivery-copy">
              <span className="eyebrow eyebrow-light">FROM OUR BOWL TO YOUR DOOR</span>
              <h2>Fresh feels closer<br />with <em>free delivery.</em></h2>
              <p>Proudly serving Markapur. Place your enquiry on WhatsApp and we’ll confirm availability and delivery details with you.</p>
              <WhatsAppLink
                className="button button-cream"
                message="Hello Froot Bowl Markapur! I'd like to enquire about today's fresh fruit choices and free home delivery. Please let me know what's available. Thank you!"
              >
                Order with free delivery <ArrowUpRight size={17} />
              </WhatsAppLink>
            </div>
            <span className="delivery-vertical">PROUDLY SERVING MARKAPUR</span>
          </div>
        </section>

        <section className="section contact-section" id="contact">
          <div className="contact-intro">
            <span className="eyebrow">LET’S TALK FRESH</span>
            <h2>We’re just a<br /><em>message away.</em></h2>
            <p>Questions, special requests, or just want to know what’s fresh today? We’d love to hear from you.</p>
            <div className="contact-links">
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`}>
                <span className="contact-link-icon"><MessageCircle size={20} /></span>
                <span><small>MESSAGE US ON WHATSAPP</small><strong>+91 63002 89995</strong></span>
                <ArrowUpRight className="contact-link-arrow" size={17} />
              </a>
              <a href={INSTAGRAM_URL} rel="noreferrer" target="_blank">
                <span className="contact-link-icon"><Instagram size={20} /></span>
                <span><small>FOLLOW ALONG ON INSTAGRAM</small><strong>@froot_bowl_markapur</strong></span>
                <ArrowUpRight className="contact-link-arrow" size={17} />
              </a>
            </div>
          </div>
          <form className="contact-form" onSubmit={sendContactForm}>
            <div className="form-topline"><span>DROP US A NOTE</span><span>01 — 04</span></div>
            <label>
              Your name
              <input autoComplete="name" maxLength="80" name="name" placeholder="e.g. Alex" required />
            </label>
            <label>
              Phone number
              <input
                autoComplete="tel"
                inputMode="tel"
                maxLength="15"
                name="phone"
                placeholder="+91"
                required
              />
            </label>
            <label>
              What can we help with?
              <span className="select-wrap">
                <select defaultValue="Menu & availability" name="topic">
                  <option>Menu &amp; availability</option>
                  <option>Delivery enquiry</option>
                  <option>Custom fruit bowl</option>
                  <option>Something else</option>
                </select>
                <ChevronDown size={17} />
              </span>
            </label>
            <label>
              Your message
              <textarea maxLength="500" name="message" placeholder="Tell us what you have in mind..." required rows="3" />
            </label>
            <button className="button button-green contact-submit" type="submit">
              Send enquiry on WhatsApp <ArrowUpRight size={17} />
            </button>
            <p className="form-footnote">Your message opens in WhatsApp so you can review it before sending.</p>
          </form>
        </section>

        <section className="instagram-section">
          <div className="instagram-heading">
            <span className="eyebrow">A LITTLE MORE FROOT BOWL</span>
            <a href={INSTAGRAM_URL} rel="noreferrer" target="_blank">
              Follow us on Instagram <ArrowUpRight size={16} />
            </a>
          </div>
          <div className="instagram-gallery">
            {[
              "photo-1490474418585-ba9bad8fd0ea",
              "photo-1511690743698-d9d85f2fbf38",
              "photo-1540420773420-3366772f4999",
              "photo-1490645935967-10de6ba17061",
            ].map((id, index) => (
              <a
                aria-label="Visit Froot Bowl Markapur on Instagram"
                className="instagram-photo"
                href={INSTAGRAM_URL}
                key={id}
                rel="noreferrer"
                target="_blank"
              >
                <FoodImage
                  alt={["Fresh fruit inspiration", "Colorful fruit bowl", "Healthy fresh choices", "Fruit to share"][index]}
                  loading="lazy"
                  src={`https://images.unsplash.com/${id}?auto=format&fit=crop&w=600&q=80`}
                />
                <span><Instagram size={20} /></span>
              </a>
            ))}
          </div>
          <p className="gallery-caption">A few fresh inspirations. Follow our Instagram for our own latest updates and availability.</p>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand-block">
            <a aria-label="Froot Bowl Markapur home" className="brand footer-brand" href="#home">
              <img src="/assets/froot-bowl-logo.jpeg" alt="" />
              <span className="brand-copy"><strong>Froot Bowl</strong><small>MARKAPUR</small></span>
            </a>
            <p>Freshness in every bowl.<br />Fresh fruit &amp; healthy choices, made for you.</p>
            <div className="footer-socials">
              <a aria-label="Instagram" href={INSTAGRAM_URL} rel="noreferrer" target="_blank"><Instagram size={17} /></a>
              <a aria-label="WhatsApp" href={`https://wa.me/${WHATSAPP_NUMBER}`}><MessageCircle size={17} /></a>
            </div>
          </div>
          <div className="footer-links">
            <strong>EXPLORE</strong>
            <a href="#menu">Our picks</a>
            <a href="#monthly">Monthly fruit packs</a>
            <a href="#build">Build a bowl</a>
            <a href="#story">Our story</a>
          </div>
          <div className="footer-links">
            <strong>SAY HELLO</strong>
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`}>WhatsApp us</a>
            <a href={INSTAGRAM_URL} rel="noreferrer" target="_blank">Instagram</a>
            <a href="#contact">Send an enquiry</a>
          </div>
          <div className="footer-location">
            <strong>FRESH, RIGHT HERE</strong>
            <p><MapPin size={17} /> Proudly serving Markapur</p>
            <p><Truck size={17} /> Free home delivery</p>
            <a href="#contact">Ask us about today’s menu <ArrowUpRight size={15} /></a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Froot Bowl Markapur</span>
          <span>FRESH <i>•</i> HEALTHY <i>•</i> DELICIOUS</span>
          <a href="#home">Back to top ↑</a>
        </div>
      </footer>

      <a className="mobile-order-bar" href="#menu">
        <span>Explore fresh picks</span><ArrowRight size={17} />
      </a>
      <a aria-label="Chat with Froot Bowl on WhatsApp" className="whatsapp-float" href={`https://wa.me/${WHATSAPP_NUMBER}`}>
        <MessageCircle size={22} /><span>Chat with us</span>
      </a>
      {cartOpen && (
        <CartDrawer
          cart={cart}
          onClose={() => setCartOpen(false)}
          onCheckout={handleCheckout}
          onQuantity={changeQuantity}
          onRemove={(id) => setCart((items) => items.filter((item) => item.id !== id))}
          onWhatsApp={() => setCartOpen(false)}
        />
      )}
      {authOpen && (
        <AuthDialog
          initialAdmin={adminRoute}
          onClose={() => setAuthOpen(false)}
          onSignedIn={handleAuthSuccess}
          purpose={authPurpose}
        />
      )}
      {checkoutOpen && user?.role === "customer" && (
        <CheckoutDialog
          cart={cart}
          onClose={() => setCheckoutOpen(false)}
          onPlaceOrder={handlePlaceOrder}
          user={user}
        />
      )}
      {ordersOpen && user?.role === "customer" && (
        <OrdersDialog
          onClose={() => setOrdersOpen(false)}
          onSignOut={handleSignOut}
          onUserUpdated={setUser}
          user={user}
        />
      )}
      {adminOpen && user?.role === "admin" && (
        <OrdersDialog admin onClose={() => setAdminOpen(false)} onSignOut={handleSignOut} />
      )}
    </>
  );
}

export default App;
