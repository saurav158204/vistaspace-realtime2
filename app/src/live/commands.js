/*
 * Voice / typed command grammar (English + Hindi). parseCommand() only identifies the command; the console executes
 * it through real application functions (see App.jsx `run`). Order matters: more specific phrases first.
 */
export const COMMANDS = [
  { id: 'start_monitoring', en: 'Start monitoring', re: /\b(start|begin|resume)\s+(the\s+)?monitor/, hi: /निगरानी\s*(शुरू|चालू)/ },
  { id: 'stop_monitoring', en: 'Stop monitoring', re: /\b(stop|end|finish)\s+(the\s+)?monitor/, hi: /निगरानी\s*(बंद|रोको|रोकें)/ },
  { id: 'pause_monitoring', en: 'Pause monitoring', re: /\bpause\s+(the\s+)?monitor/, hi: /निगरानी\s*(रोको|विराम)/ },
  { id: 'hands_on', en: 'Enable hand tracking', re: /\b(enable|turn on|start|switch on)\s+(the\s+)?hand\s*tracking/, hi: /हाथ\s*(ट्रैकिंग)?\s*(चालू|शुरू)/ },
  { id: 'hands_off', en: 'Disable hand tracking', re: /\b(disable|turn off|stop|switch off)\s+(the\s+)?hand\s*tracking/, hi: /हाथ\s*(ट्रैकिंग)?\s*बंद/ },
  { id: 'pose_on', en: 'Enable pose tracking', re: /\b(enable|turn on|start)\s+(the\s+)?(pose|posture|body)\s*tracking/, hi: null },
  { id: 'pose_off', en: 'Disable pose tracking', re: /\b(disable|turn off|stop)\s+(the\s+)?(pose|posture|body)\s*tracking/, hi: null },
  { id: 'calibrate', en: 'Calibrate posture', re: /\bcalibrat/, hi: /कैलिब्रेट|अंशांकन/ },
  { id: 'posture_status', en: 'What is my posture status?', re: /\bposture\b/, hi: /मुद्रा|पोस्चर/ },
  { id: 'complete_step', en: 'Mark step complete', re: /\b(mark|confirm|set)\s+(the\s+)?(current\s+)?step\s+(as\s+)?(complete|completed|done|finished)|\bstep\s+(complete|completed|done)\b|\bcomplete\s+(the\s+)?(current\s+)?step\b/, hi: /चरण\s*(पूर्ण|पूरा|समाप्त)/ },
  { id: 'next_step', en: 'Next step', re: /\b(next|skip)\s+(the\s+)?step\b|\bgo\s+to\s+(the\s+)?next\b/, hi: /अगला\s*चरण/ },
  { id: 'prev_step', en: 'Previous step', re: /\b(previous|last|prior)\s+step\b|\bgo\s+back\b|\bstep\s+back\b/, hi: /पिछला\s*चरण|वापस\s*जाओ/ },
  { id: 'read_procedure', en: 'Read current procedure', re: /\bread\s+(the\s+)?(current\s+)?(procedure|step|instruction)|\bcurrent\s+(step|procedure)\b|\bwhat('s|\s+is)\s+the\s+(current\s+)?(step|procedure)/, hi: /प्रक्रिया\s*(पढ़ो|पढ़ें|बताओ)|वर्तमान\s*चरण/ },
  { id: 'repeat', en: 'Repeat instruction', re: /\b(repeat|say\s+(that|it)\s+again|again)\b/, hi: /दोहराओ|फिर\s*से/ },
  { id: 'unmute_alerts', en: 'Unmute alerts', re: /\b(unmute|enable|turn on)\s+(the\s+)?(voice\s+)?alerts\b/, hi: /अलर्ट\s*(चालू|अनम्यूट)/ },
  { id: 'mute_alerts', en: 'Mute alerts', re: /\b(mute|silence|disable|turn off)\s+(the\s+)?(voice\s+)?alerts\b/, hi: /अलर्ट\s*(बंद|म्यूट)/ },
  { id: 'temperature', en: 'Show temperature', re: /\btemperature|\btemp\b|\bsensors?\b/, hi: /तापमान|सेंसर/ },
  { id: 'system_health', en: 'Show system health', re: /\bsystem\s*(health|status)?\b|\bhealth\b/, hi: /सिस्टम/ },
  { id: 'monitoring_status', en: 'Monitoring status', re: /\b(monitoring\s+)?status\b|\bare\s+you\s+(watching|monitoring)/, hi: /स्थिति/ },
  { id: 'capture', en: 'Capture evidence', re: /\b(capture|take)\s+(a\s+)?(snapshot|evidence|picture|photo)/, hi: /फोटो|स्नैपशॉट/ },
  { id: 'lang_hi', en: 'Switch to Hindi', re: /\b(hindi)\b/, hi: /हिंदी|हिन्दी/ },
  { id: 'lang_en', en: 'Switch to English', re: /\benglish\b/, hi: /अंग्रेज़ी|अंग्रेजी|इंग्लिश/ },
  { id: 'help', en: 'Help', re: /\bhelp\b|\bwhat\s+can\s+(you|i)\s+say/, hi: /मदद|सहायता/ },
];

export const isHindi = t => /[ऀ-ॿ]/.test(t);

export function parseCommand(text) {
  const t = text.toLowerCase().trim();
  for (const c of COMMANDS) if (c.re.test(t) || (c.hi && c.hi.test(text))) return c.id;
  return null;
}

export const SUGGESTED = ['Start monitoring', 'What is my posture status?', 'Read current procedure', 'Mark step complete', 'Show temperature', 'Show system health'];
