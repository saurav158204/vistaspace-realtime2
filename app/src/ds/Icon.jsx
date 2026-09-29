import React from 'react';
import {
  WifiOff, Database, CircleCheck, Check, Satellite, ShieldCheck, OctagonAlert, TriangleAlert, ArrowRight, Volume2, VolumeX,
  FileJson, Download, LoaderCircle, CircleArrowRight, CircleDashed, MoveUpRight, Info, Mic, MicOff, SendHorizontal, X, Square, AudioLines,
  Wifi, Camera, CameraOff, Hand, PersonStanding, Activity, Box, Settings, Play, Pause, ChevronLeft, ChevronRight, Thermometer, Cpu, Crosshair, ScanLine, Radio, RotateCcw, FileText, Mouse, Headphones,
} from 'lucide-react';

// Lucide glyphs, bundled so the console works offline. Same 1.5 stroke as the design's lucide-static icons.
const ICONS = {
  'wifi-off': WifiOff, database: Database, 'circle-check': CircleCheck, check: Check, satellite: Satellite, 'shield-check': ShieldCheck,
  'octagon-alert': OctagonAlert, 'triangle-alert': TriangleAlert, 'arrow-right': ArrowRight, 'volume-2': Volume2, 'volume-x': VolumeX,
  'file-json': FileJson, download: Download, 'loader-circle': LoaderCircle, 'circle-arrow-right': CircleArrowRight, 'circle-dashed': CircleDashed,
  'move-up-right': MoveUpRight, info: Info, mic: Mic, 'mic-off': MicOff, send: SendHorizontal, x: X, square: Square, 'audio-lines': AudioLines,
  wifi: Wifi, camera: Camera, 'camera-off': CameraOff, hand: Hand, person: PersonStanding, activity: Activity, box: Box, settings: Settings, play: Play, pause: Pause,
  'chevron-left': ChevronLeft, 'chevron-right': ChevronRight, thermometer: Thermometer, cpu: Cpu, crosshair: Crosshair, scan: ScanLine, radio: Radio, reset: RotateCcw, file: FileText,
};

export function Icon({ name, size = 14, color = 'currentColor', strokeWidth = 1.5, title, style }) {
  const Glyph = ICONS[name];
  return <span role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}
    style={{ display: 'inline-flex', width: size, height: size, flex: 'none', color, lineHeight: 0, ...style }}>
    {Glyph ? <Glyph width="100%" height="100%" strokeWidth={strokeWidth} /> : null}
  </span>;
}
