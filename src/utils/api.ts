import { API_URL } from '@env';
import axios from 'axios';

console.log("API_URL", API_URL);

const api = axios.create({
  baseURL: API_URL,
});

export default api;
