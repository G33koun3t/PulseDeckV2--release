import {
  Globe, Music, MessageCircle, Video, Tv, Cloud, Youtube, Headphones,
  Radio, Gamepad2, ShoppingCart, BookOpen, Mail, Camera, Heart, Star,
  Zap, Code, Terminal, Database, Server, Shield, Palette, Mic,
  Activity, Compass, Rss, Phone
} from 'lucide-react';

export const WEBVIEW_ICONS = {
  Globe, Music, MessageCircle, Video, Tv, Cloud, Youtube, Headphones,
  Radio, Gamepad2, ShoppingCart, BookOpen, Mail, Camera, Heart, Star,
  Zap, Code, Terminal, Database, Server, Shield, Palette, Mic,
  Activity, Compass, Rss, Phone
};

export const WEBVIEW_ICON_NAMES = Object.keys(WEBVIEW_ICONS);

export const getWebviewIcon = (iconName) => WEBVIEW_ICONS[iconName] || Globe;
