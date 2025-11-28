import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import io from 'socket.io-client';
import axios from 'axios';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const SOCKET_SERVER_URL = 'http://192.168.1.55:5000'; // Backend URL
const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjdjOWZkMDY4MzZjYzQ1OTY4NGM0MzlkYjZkNGYyY2ZlIiwiaCI6Im11cm11cjY0In0='; // OpenRouteService key

type Coordinate = { latitude: number; longitude: number };
type TrackedUser = { latitude: number; longitude: number; username: string };
type TrackedLocations = Record<string, TrackedUser>;
type UserLocation = { userId: string; username: string; coords: Coordinate };

// Dummy test user in Delhi
const DUMMY_USER: TrackedUser = {
  latitude: 28.6139,
  longitude: 77.2090,
  username: 'Dummy User Delhi',
};

// India Approximate Bounding Box
const INDIA_BOUNDS = {
  minLat: 6.55,
  maxLat: 35.675,
  minLng: 68.11,
  maxLng: 97.4,
};

function isInIndia(lat: number, lng: number): boolean {
  return lat >= INDIA_BOUNDS.minLat && lat <= INDIA_BOUNDS.maxLat &&
         lng >= INDIA_BOUNDS.minLng && lng <= INDIA_BOUNDS.maxLng;
}

async function fetchRouteOrLine(start: Coordinate, end: Coordinate): Promise<Coordinate[]> {
  const startInIndia = isInIndia(start.latitude, start.longitude);
  const endInIndia = isInIndia(end.latitude, end.longitude);

  if (startInIndia && endInIndia) {
    try {
      const res = await axios.get(
        `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${ORS_API_KEY}&start=${start.longitude},${start.latitude}&end=${end.longitude},${end.latitude}`
      );
      return res.data.features[0].geometry.coordinates.map(([lng, lat]: [number, number]) => ({
        latitude: lat,
        longitude: lng,
      }));
    } catch (err) {
      console.warn('OpenRouteService API failed, falling back to straight line.', err);
    }
  }

  // Fallback straight line for out-of-India or error cases
  return [start, end];
}

async function buildFullRoute(points: Coordinate[]): Promise<Coordinate[]> {
  if (points.length < 2) return [];
  let fullRoute: Coordinate[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const segment = await fetchRouteOrLine(points[i], points[i + 1]);
    if (fullRoute.length > 0) fullRoute.pop(); // avoid dup point
    fullRoute = fullRoute.concat(segment);
  }
  return fullRoute;
}

const leafletTemplate = (
  userLocation: Coordinate,
  trackedLocations: TrackedLocations,
  routeCoords: Coordinate[]
): string => {
  const markersHtml = Object.entries(trackedLocations)
    .map(([id, info]) =>
      `
      L.marker([${info.latitude}, ${info.longitude}])
        .addTo(map)
        .bindPopup('${info.username}');
      `
    ).join('');

  const yourMarkerHtml = `
    L.marker([${userLocation.latitude}, ${userLocation.longitude}])
      .addTo(map)
      .bindPopup('You are here')
      .openPopup();
  `;

  const routeLatLngs = routeCoords.length > 0
    ? `[${routeCoords.map(c => `[${c.latitude},${c.longitude}]`).join(',')}]`
    : '[]';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>
</head>
<body style="margin:0">
  <div id="map" style="width:100vw; height:100vh;"></div>
  <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
  <script>
    var map = L.map('map').setView([${userLocation.latitude}, ${userLocation.longitude}], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    ${yourMarkerHtml}
    ${markersHtml}

    var routeLatLngs = ${routeLatLngs};
    if(routeLatLngs.length > 1){
      var polyline = L.polyline(routeLatLngs, {color: 'blue', weight: 4}).addTo(map);
      map.fitBounds(polyline.getBounds());
    }
  </script>
</body>
</html>
`;
};

const HomeScreen = () => {
  const { user, logout, token } = useAuth();
  
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [trackedLocations, setTrackedLocations] = useState<TrackedLocations>({ dummy: DUMMY_USER });
  const [routeCoords, setRouteCoords] = useState<Coordinate[]>([]);
  const [loading, setLoading] = useState(true);
  const socketRef = React.useRef<ReturnType<typeof io> | null>(null);

  // Fetch tracked users from backend and add dummy
  useEffect(() => {
    if (!token) return;
    const fetchTrackedLocations = async () => {
      try {
        const res = await api.get('/users/tracked-users');
        const tracked: TrackedLocations = { dummy: DUMMY_USER };
        res.data.forEach((u: any) => {
          if (u._id !== user?.id && u.lastKnownLocation?.coordinates?.length === 2) {
            tracked[u._id] = {
              latitude: u.lastKnownLocation.coordinates[1],
              longitude: u.lastKnownLocation.coordinates[0],
              username: u.username,
            };
          }
        });
        setTrackedLocations(tracked);
      } catch (err) {
        console.error('Failed to fetch tracked users:', err);
      }
    };
    fetchTrackedLocations();
  }, [token, user?.id]);

  // Handle socket connections and newLocation updates
  useEffect(() => {
    if (!token) return;
    socketRef.current = io(SOCKET_SERVER_URL, { auth: { token }, transports: ['websocket'] });
    socketRef.current.on('connect', () => {
      console.log('Socket connected:', socketRef.current?.id);
    });
    socketRef.current.on('newLocation', (data: UserLocation) => {
      setTrackedLocations((prev) => ({
        ...prev,
        [data.userId]: {
          latitude: data.coords.latitude,
          longitude: data.coords.longitude,
          username: data.username,
        },
      }));
    });
    socketRef.current.on('disconnect', () => {
      console.log('Socket disconnected');
    });
    return () => { socketRef.current?.disconnect(); };
  }, [token]);

  // Track and update user location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow location access to use the app');
        return;
      }
      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Highest, distanceInterval: 10, timeInterval: 5000 },
        (loc) => {
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setLocation(coords);
          socketRef.current?.emit('locationUpdate', {
            userId: user?.id,
            username: user?.username,
            coords,
          });
          setLoading(false);
        }
      );
      return () => subscription.remove();
    })();
  }, [user]);

  // Build full route joining all points with API or straight lines
  useEffect(() => {
    const buildRoute = async () => {
      if (!location) return;
      const points = [
        location,
        ...Object.values(trackedLocations),
      ];
      // Build route by chaining ORS routes or straight lines
      let fullRoute: Coordinate[] = [];
      for(let i = 0; i < points.length - 1; i++) {
        let segment = await fetchRouteOrLine(points[i], points[i+1]);
        if(fullRoute.length > 0) fullRoute.pop(); // avoid duplicates
        fullRoute = fullRoute.concat(segment);
      }
      setRouteCoords(fullRoute);
      setLoading(false);
    };
    buildRoute();
  }, [location, trackedLocations]);

  if (loading || !location) {
    return (
      <View style={{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'#111'}}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={{color:'#fff',marginTop:8}}>Loading location and route...</Text>
      </View>
    );
  }

  return (
    <View style={{flex:1,backgroundColor:'#111'}}>
      <View style={{padding:16,flexDirection:'row',justifyContent:'space-between',alignItems:'center',backgroundColor:'#222'}}>
        <Text style={{color:'white',fontWeight:'bold',fontSize:18}}>Welcome, {user?.username}!</Text>
        <TouchableOpacity onPress={logout} style={{backgroundColor:'#e11d48',paddingHorizontal:16,paddingVertical:8,borderRadius:10}}>
          <Text style={{color:'white',fontWeight:'bold'}}>Logout</Text>
        </TouchableOpacity>
      </View>
      <WebView
        originWhitelist={['*']}
        source={{ html: leafletTemplate(location, trackedLocations, routeCoords) }}
        style={{ flex: 1 }}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
};

export default HomeScreen;
