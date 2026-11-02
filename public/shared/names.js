// Realistic-looking player names for server bots (style of real usernames).
import { isBad } from './filter.js';
const FIRST = ['Liam', 'Noah', 'Oliver', 'Elijah', 'James', 'William', 'Benjamin', 'Lucas', 'Henry', 'Theo', 'Jack', 'Levi', 'Mason', 'Ethan',
  'Aiden', 'Logan', 'Owen', 'Caleb', 'Ryan', 'Nathan', 'Dylan', 'Leo', 'Max', 'Finn', 'Kai', 'Jayden', 'Carter', 'Hunter', 'Eli', 'Luca',
  'Ava', 'Emma', 'Olivia', 'Sophia', 'Mia', 'Isla', 'Amelia', 'Harper', 'Evelyn', 'Luna', 'Chloe', 'Ella', 'Lily', 'Zoe', 'Nora', 'Grace',
  'Ruby', 'Ivy', 'Maya', 'Aria', 'Leah', 'Hazel', 'Stella', 'Willow', 'Sadie', 'Ellie', 'Riley', 'Jade', 'Piper', 'Skye',
  'Mateo', 'Diego', 'Santi', 'Pablo', 'Hugo', 'Luka', 'Mats', 'Lars', 'Jonas', 'Emil', 'Felix', 'Oscar', 'Milo', 'Arlo', 'Rowan', 'Ezra',
  'Kenji', 'Haruto', 'Ren', 'Yuki', 'Minh', 'Arjun', 'Rohan', 'Omar', 'Yusuf', 'Ali', 'Adam', 'Zain', 'Ibrahim', 'Jamal', 'Malik', 'Andre',
  'Tyler', 'Brandon', 'Josh', 'Jake', 'Connor', 'Cole', 'Blake', 'Chase', 'Brody', 'Tanner', 'Colton', 'Jace', 'Ryder', 'Zach', 'Sam', 'Alex',
  'Bella', 'Sofia', 'Layla', 'Nova', 'Aurora', 'Violet', 'Lucy', 'Anna', 'Lena', 'Elif', 'Sara', 'Nina', 'Kira', 'Mila', 'Tessa', 'Daisy'];
const WORDS = ['Shadow', 'Blaze', 'Frost', 'Storm', 'Ninja', 'Dragon', 'Wolf', 'Viper', 'Ghost', 'Phantom', 'Tiger', 'Falcon', 'Hawk', 'Raven',
  'Titan', 'Rogue', 'Knight', 'Sniper', 'Gamer', 'Slayer', 'Hunter', 'Pixel', 'Turbo', 'Rocket', 'Comet', 'Nova', 'Bolt', 'Cyber', 'Venom', 'Fury',
  'Panda', 'Fox', 'Bunny', 'Kitty', 'Taco', 'Noodle', 'Potato', 'Cookie', 'Waffle', 'Bean', 'Nugget', 'Pickle', 'Mango', 'Muffin', 'Toast',
  'Tank', 'Cannon', 'Blaster', 'Bullet', 'Striker', 'Ace', 'Legend', 'Hero', 'Boss', 'King', 'Queen', 'Chief', 'Captain', 'Wizard', 'Reaper'];
const ADJ = ['Sneaky', 'Crazy', 'Epic', 'Silent', 'Lucky', 'Mighty', 'Fast', 'Angry', 'Happy', 'Sleepy', 'Dark', 'Cool', 'Super', 'Hyper', 'Mega',
  'Tiny', 'Big', 'Golden', 'Icy', 'Fiery', 'Cosmic', 'Wild', 'Brave', 'Salty', 'Spicy', 'Chill', 'Toxic', 'Royal', 'Shiny', 'Rapid',
  'Noob', 'Pro', 'Real', 'Lil', 'Its', 'Mr', 'Not', 'Just', 'Only', 'Daily'];

const pick = (a, r) => a[Math.floor(r() * a.length)];
const num = (r, max) => Math.floor(r() * max);
const year = (r) => 2008 + num(r, 10);

const STYLES = [
  (r) => pick(FIRST, r) + year(r),                                   // Liam2013
  (r) => pick(FIRST, r) + num(r, 999),                               // Mia482
  (r) => pick(FIRST, r).toLowerCase() + '_' + pick(WORDS, r).toLowerCase(), // ethan_wolf
  (r) => 'xX' + pick(WORDS, r) + 'Xx',                              // xXShadowXx
  (r) => 'xX_' + pick(WORDS, r) + '_Xx',                            // xX_Ghost_Xx
  (r) => 'itz' + pick(FIRST, r).toLowerCase(),                       // itzmaya
  (r) => 'itz_' + pick(FIRST, r).toLowerCase() + num(r, 99),         // itz_noah42
  (r) => pick(FIRST, r).toLowerCase() + 'plays',                     // noahplays
  (r) => pick(FIRST, r) + 'Gamer' + num(r, 99),                      // AvaGamer12
  (r) => 'TheReal' + pick(FIRST, r),                                 // TheRealEthan
  (r) => pick(FIRST, r).toLowerCase() + '_yt',                       // ava_yt
  (r) => pick(ADJ, r) + pick(WORDS, r) + num(r, 9999),               // SneakyFox482
  (r) => pick(ADJ, r) + pick(WORDS, r),                              // CosmicTaco
  (r) => pick(ADJ, r).toLowerCase() + pick(WORDS, r).toLowerCase() + num(r, 99), // salticookie77
  (r) => pick(WORDS, r) + '_' + pick(FIRST, r),                      // Blaze_Liam
  (r) => pick(FIRST, r) + '_' + pick(WORDS, r) + num(r, 99),         // Kai_Dragon7
  (r) => pick(WORDS, r) + 'Master' + num(r, 999),                    // TankMaster301
  (r) => 'Not' + pick(FIRST, r),                                     // NotLuca
  (r) => pick(FIRST, r).toLowerCase() + '_' + pick(['rbx', 'tv', 'gg'], r), // zoe_rbx
  (r) => pick(FIRST, r) + pick(FIRST, r).slice(0, 3) + num(r, 99),   // LeoMia5
  (r) => 'iam' + pick(FIRST, r).toLowerCase() + num(r, 999),         // iamharper88
  (r) => pick(WORDS, r).toLowerCase() + 'z' + num(r, 99),            // ghostz12
  (r) => pick(FIRST, r) + '_' + year(r),                             // Nora_2011
  (r) => 'Lil' + pick(WORDS, r),                                     // LilNugget
];

export function botName(rng = Math.random) {
  for (let i = 0; i < 8; i++) {
    let n = pick(STYLES, rng)(rng);
    if (n.length > 18) n = n.slice(0, 18);
    if (!isBad(n)) return n; // never produce anything the chat filter would flag
  }
  return pick(FIRST, rng) + num(rng, 999);
}

export function botLevel(rng = Math.random) {
  const r = rng();
  if (r < 0.35) return 1 + Math.floor(rng() * 20);
  if (r < 0.65) return 15 + Math.floor(rng() * 30);
  if (r < 0.85) return 40 + Math.floor(rng() * 80);
  return 110 + Math.floor(rng() * 380);
}
