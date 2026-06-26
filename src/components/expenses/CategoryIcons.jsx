import React from 'react';
import {
  Briefcase, Home, ShoppingCart, Smartphone, Coffee, Plane, Car, Heart, Zap, Star,
  Utensils, Monitor, Tv, Music, Book, GraduationCap, Gift, Baby, Dumbbell, Stethoscope,
  Pill, Syringe, Scissors, Camera, Gamepad, Ticket, Bus, Train, Ship, Landmark,
  Building, Wrench, Hammer, Smile, Angry, Frown, Users, User, Dog, Cat, Fish,
  Bird, Leaf, TreePine, Droplet, Flame, Wind, Cloud, Sun, Moon
} from 'lucide-react';

export const CATEGORY_ICONS = {
  'briefcase': Briefcase,
  'home': Home,
  'shopping-cart': ShoppingCart,
  'smartphone': Smartphone,
  'coffee': Coffee,
  'plane': Plane,
  'car': Car,
  'heart': Heart,
  'zap': Zap,
  'star': Star,
  'utensils': Utensils,
  'monitor': Monitor,
  'tv': Tv,
  'music': Music,
  'book': Book,
  'graduation-cap': GraduationCap,
  'gift': Gift,
  'baby': Baby,
  'dumbbell': Dumbbell,
  'stethoscope': Stethoscope,
  'pill': Pill,
  'syringe': Syringe,
  'scissors': Scissors,
  'camera': Camera,
  'gamepad': Gamepad,
  'ticket': Ticket,
  'bus': Bus,
  'train': Train,
  'ship': Ship,
  'landmark': Landmark,
  'building': Building,
  'wrench': Wrench,
  'hammer': Hammer,
  'smile': Smile,
  'angry': Angry,
  'frown': Frown,
  'users': Users,
  'user': User,
  'dog': Dog,
  'cat': Cat,
  'fish': Fish,
  'bird': Bird,
  'leaf': Leaf,
  'tree': TreePine,
  'droplet': Droplet,
  'flame': Flame,
  'wind': Wind,
  'cloud': Cloud,
  'sun': Sun,
  'moon': Moon
};

export const CATEGORY_COLORS = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#f59e0b', // amber-500
  '#eab308', // yellow-500
  '#84cc16', // lime-500
  '#22c55e', // green-500
  '#10b981', // emerald-500
  '#14b8a6', // teal-500
  '#06b6d4', // cyan-500
  '#0ea5e9', // sky-500
  '#3b82f6', // blue-500
  '#6366f1', // indigo-500
  '#8b5cf6', // violet-500
  '#a855f7', // purple-500
  '#d946ef', // fuchsia-500
  '#ec4899', // pink-500
  '#f43f5e', // rose-500
  '#64748b', // slate-500
  '#71717a', // zinc-500
  '#78716c', // stone-500
];

export function renderCategoryIcon(iconName, color, className = "w-5 h-5") {
  const IconComponent = CATEGORY_ICONS[iconName] || CATEGORY_ICONS['star'];
  return <IconComponent className={className} style={{ color: color || '#a3a3a3' }} />;
}
