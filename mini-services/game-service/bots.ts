import { generateCrashPoint } from './crash'

/**
 * 99win — Bot engine. Fake players keep the room alive: they place bets,
 * cash out (or bust), and fill the chat. Bots are fully in-memory — they
 * never touch the database.
 */

export interface BotIdentity {
  id: string
  name: string
  hue: number
}

const BOT_NAMES = [
  'Ali_Khan786', 'BilalKing', 'Raja_Babu', 'Zain_99x', 'LuckyAli',
  'UstaadJi', 'Sana_Sheikh', 'Faisal_King', 'Cr7_Umar', 'Hassan_11',
  'JuttSahab', 'Ayan.Virat', 'Guest4821', 'PakLion', 'Shahzada_9',
  'SadaHaq', 'MumbaiBhai', 'Karachi_King', 'WaseemX', 'TipuSultan',
  'DesiGamer', 'PunterPro', 'RehanBoss', 'Amir_Shah', 'NoorFatima',
  'KingKohli', 'BabarAzam360', 'GoldFinder', 'HighFlyer99', 'MrLucky',
  'SheikhSahab', 'ChachaCricket', 'MoneyMaker', 'StarPlayer', 'VIP_Rajan',
]

export const BOTS: BotIdentity[] = BOT_NAMES.map((name, i) => ({
  id: `bot_${i}`,
  name,
  hue: (i * 137) % 360,
}))

export function pickRandomBots(min: number, max: number): BotIdentity[] {
  const count = min + Math.floor(Math.random() * (max - min + 1))
  const pool = [...BOTS]
  const picked: BotIdentity[] = []
  for (let i = 0; i < count && pool.length; i++) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
  }
  return picked
}

/** Weighted bet amounts — small stakes are most common. */
const BET_AMOUNTS = [
  16, 16, 16, 20, 20, 25, 30, 30, 40, 50, 50, 50, 70, 80, 100, 100, 100,
  120, 150, 150, 200, 200, 250, 300, 300, 400, 500, 500, 700, 800, 1000,
  1000, 1200, 1500, 2000, 2500, 3000, 5000,
]

export function randomBotAmount(): number {
  return BET_AMOUNTS[Math.floor(Math.random() * BET_AMOUNTS.length)]
}

/** Cashout target: mostly low (1.1–3x), occasionally greedy. */
export function randomBotTarget(): number {
  const r = Math.random()
  const t = 1.1 + Math.pow(r, 2.4) * 12
  return Math.round(t * 100) / 100
}

export function randomBotCrash(): number {
  return generateCrashPoint()
}

// ---------------- Chat ----------------

export const CHAT_GENERAL = [
  'bhai last round ka wait kar raha hoon :fire:',
  'minimum 16 PKR hai sab aa jao',
  '1.5x pe cashout karo, safe strategy :check:',
  'is baar 3x ka target hai mera',
  'plane ready hai :plane: let’s gooo',
  'trust the process brothers',
  'green bus kab ayegi :money:',
  'aaj to market green hai',
  '2x pe nikal jao warna roula ho jata hai',
  'kisi ne 50x mara hai kya aaj?',
  'Easypaisa se deposit 2 min me ho gaya mera',
  'withdraw bhi fast hai, 10 min me mila',
  'admin bhai cashback double kar do :laugh:',
  'new players luck best hota hai fr',
  'loss recover karna hai is hafte',
  'pattern dekho bhai 3 low round gaye ab high ayega',
  'my gut says 10x incoming :eyes:',
  'sab cash out early karo is bar',
  'bilkul crash hoga is bar dekh lena :smirk:',
  'PKR 500 lagate hain chalo',
  'ye game ki timing sabse achi hai',
  'boys kal 12x tha screenshot bhi hai',
  'auto cashout 1.8x laga lo tension free',
  'kal mera bhai ne 30x mara tha',
]

export const CHAT_AFTER_LOW_CRASH = [
  'kya yaar phir 1.2x :broken:',
  'plane to jaldi hi gir gaya',
  'engine kharab hai aaj plane ka',
  '1.14x seriously? :cry:',
  'ab high multiplier ayega wait karo',
  'yaar bhai dil tod diya',
  'next round me sab nikal jao fast',
  'aircraft ne betray kar diya',
  'chota crash, bada recovery — ab dekhna',
  'back to back low… sambhal ke',
]

export const CHAT_AFTER_HIGH_CRASH = [
  'OMG kya round tha :rocket::rocket:',
  'legendary round bro :fire:',
  'cash out at peak, feels amazing',
  'ye round to historic tha',
  'ab aayega asli maza',
  'big fish caught today :fish:',
  'plane aaj udd hi gaya',
  '10x+ dekh ke dil khush ho gaya',
  'hold karna payed off',
]

export const CHAT_WAITING = [
  'place your bets :plane:',
  'chalo is round me kuch bada karte hain',
  'fast fast bets lagao',
  '3… 2… 1… takeoff soon',
  'is round ka wait tha mujhe',
  'last chance for this session boys',
]

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Occasional self-reported bot cashout line */
export function botCashoutLine(m: number, win: number): string | null {
  if (Math.random() > 0.18) return null
  const winStr = win >= 1000 ? `${(win / 1000).toFixed(1)}k` : `${Math.round(win)}`
  return pick([
    `cash out ${m.toFixed(2)}x :check: +PKR ${winStr}`,
    `${m.toFixed(2)}x pe nikal gaya :fire:`,
    `+PKR ${winStr} alhamdulillah`,
    `${m.toFixed(2)}x :check: easy money`,
  ])
}
