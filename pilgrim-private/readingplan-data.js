// readingplan-data.js — Pilgrim Private ES Module (v4.58.0)
// Reading Plans: the Story Flow outline as static data. NO imports, NO DOM, NO localStorage.
// Source: claude/spec-reading-plans-v1.md (Rev 2) + claude/spec-reading-plan-story-flow-outline-v1.md.
// Only progress is ever stored (readingplan.js); this outline lives in code, so editing it can
// never touch saved data. Item and group IDs are PERMANENT: once shipped they are never renamed
// or reused (progress is keyed by item ID only, never by position).
//
// Shape built by rpBuildStoryFlow():
//   { id:'storyflow', name, parts:[ { id, name, groups:[ { id, name, partId, chron, items:[ Item ] } ] } ],
//     items:[ Item ] (flat, plan order), index:{ id: position }, groups:[...flat] }
// Item (chapter): { id:'Gen.12', type:'ch', book:'Gen', label:'Genesis 12', short:'12', w:94 }
// Item (event):   { id:'ev.baptism-of-jesus', type:'ev', label:'Baptism of Jesus', passages:'Matthew 3:13-17; ...', note?, sub?, w:89 }
// Weights are integers (chapter 94, event 89) so percentages never suffer float error:
// Part 7 totals 94 events x 89 = 8,366 = 89 Gospel chapters x 94.

/** [code, full name, short name, chapter count] in canon order. */
var RP_BOOKS = [
  ['Gen','Genesis','Gen',50],['Exod','Exodus','Exod',40],['Lev','Leviticus','Lev',27],['Num','Numbers','Num',36],
  ['Deut','Deuteronomy','Deut',34],['Josh','Joshua','Josh',24],['Judg','Judges','Judg',21],['Ruth','Ruth','Ruth',4],
  ['1Sam','1 Samuel','1 Sam',31],['2Sam','2 Samuel','2 Sam',24],['1Kgs','1 Kings','1 Kgs',22],['2Kgs','2 Kings','2 Kgs',25],
  ['1Chr','1 Chronicles','1 Chr',29],['2Chr','2 Chronicles','2 Chr',36],['Ezra','Ezra','Ezra',10],['Neh','Nehemiah','Neh',13],
  ['Esth','Esther','Esth',10],['Job','Job','Job',42],['Ps','Psalms','Ps',150],['Prov','Proverbs','Prov',31],
  ['Eccl','Ecclesiastes','Eccl',12],['Song','Song of Solomon','Song',8],['Isa','Isaiah','Isa',66],['Jer','Jeremiah','Jer',52],
  ['Lam','Lamentations','Lam',5],['Ezek','Ezekiel','Ezek',48],['Dan','Daniel','Dan',12],['Hos','Hosea','Hos',14],
  ['Joel','Joel','Joel',3],['Amos','Amos','Amos',9],['Obad','Obadiah','Obad',1],['Jonah','Jonah','Jonah',4],
  ['Mic','Micah','Mic',7],['Nah','Nahum','Nah',3],['Hab','Habakkuk','Hab',3],['Zeph','Zephaniah','Zeph',3],
  ['Hag','Haggai','Hag',2],['Zech','Zechariah','Zech',14],['Mal','Malachi','Mal',4],
  ['Matt','Matthew','Matt',28],['Mark','Mark','Mark',16],['Luke','Luke','Luke',24],['John','John','John',21],
  ['Acts','Acts','Acts',28],['Rom','Romans','Rom',16],['1Cor','1 Corinthians','1 Cor',16],['2Cor','2 Corinthians','2 Cor',13],
  ['Gal','Galatians','Gal',6],['Eph','Ephesians','Eph',6],['Phil','Philippians','Phil',4],['Col','Colossians','Col',4],
  ['1Thess','1 Thessalonians','1 Thess',5],['2Thess','2 Thessalonians','2 Thess',3],['1Tim','1 Timothy','1 Tim',6],
  ['2Tim','2 Timothy','2 Tim',4],['Titus','Titus','Titus',3],['Phlm','Philemon','Phlm',1],['Heb','Hebrews','Heb',13],
  ['Jas','James','Jas',5],['1Pet','1 Peter','1 Pet',5],['2Pet','2 Peter','2 Pet',3],['1John','1 John','1 John',5],
  ['2John','2 John','2 John',1],['3John','3 John','3 John',1],['Jude','Jude','Jude',1],['Rev','Revelation','Rev',22]
];

/** Acts chapters split in two because letters are inserted mid-chapter. */
var RP_SPLITS = {
  '18a': { chapter: 18, label: 'Acts 18:1-17', short: '18:1-17' },
  '18b': { chapter: 18, label: 'Acts 18:18-28', short: '18:18-28' },
  '20a': { chapter: 20, label: 'Acts 20:1-3', short: '20:1-3' },
  '20b': { chapter: 20, label: 'Acts 20:4-38', short: '20:4-38' }
};

var RP_W_CH = 94;   // weight of one chapter item
var RP_W_EV = 89;   // weight of one Gospel event (94 events x 89 = 89 chapters x 94)

/** Gospel names used inside passage strings -> book codes. */
var RP_GOSPEL_CODES = { Matthew: 'Matt', Mark: 'Mark', Luke: 'Luke', John: 'John' };

// ── Gospel harmony events (Part 7), 94 total, in outline order ──────────────────────────
// [title, passages, optional extras {note, sub}]
var RP_EVENTS = {
  A: [
    ['The Word became flesh', 'John 1:1-18; Luke 1:1-4'],
    ['Genealogies of Jesus', 'Matthew 1:1-17; Luke 3:23-38'],
    ['John the Baptist’s birth foretold', 'Luke 1:5-25'],
    ['Announcement to Mary', 'Luke 1:26-38'],
    ['Mary visits Elizabeth', 'Luke 1:39-56'],
    ['John is born', 'Luke 1:57-80'],
    ['Joseph’s dream', 'Matthew 1:18-25'],
    ['Jesus is born, the shepherds', 'Luke 2:1-20'],
    ['Presentation at the temple', 'Luke 2:21-38'],
    ['The Magi', 'Matthew 2:1-12'],
    ['Flight to Egypt, return to Nazareth', 'Matthew 2:13-23; Luke 2:39'],
    ['Jesus at twelve in the temple', 'Luke 2:40-52']
  ],
  B: [
    ['John the Baptist preaches', 'Matthew 3:1-12; Mark 1:1-8; Luke 3:1-18; John 1:19-28'],
    ['Baptism of Jesus', 'Matthew 3:13-17; Mark 1:9-11; Luke 3:21-22'],
    ['Temptation of Jesus', 'Matthew 4:1-11; Mark 1:12-13; Luke 4:1-13'],
    ['John’s witness, the first disciples', 'John 1:29-51']
  ],
  C: [
    ['Water into wine at Cana', 'John 2:1-11'],
    ['First temple cleansing', 'John 2:12-25'],
    ['Nicodemus', 'John 3:1-21'],
    ['John’s last testimony', 'John 3:22-36'],
    ['The Samaritan woman', 'John 4:1-42'],
    ['The official’s son healed', 'John 4:43-54'],
    ['Rejection at Nazareth, first visit', 'Luke 4:14-30', { note: 'A second visit appears later (Matthew 13:53-58; Mark 6:1-6).' }]
  ],
  D: [
    ['Call of the fishermen', 'Matthew 4:18-22; Mark 1:16-20; Luke 5:1-11'],
    ['Demoniac in the Capernaum synagogue', 'Mark 1:21-28; Luke 4:31-37'],
    ['Peter’s mother-in-law and evening healings', 'Matthew 8:14-17; Mark 1:29-34; Luke 4:38-41'],
    ['Preaching tour of Galilee', 'Matthew 4:23-25; Mark 1:35-39; Luke 4:42-44'],
    ['Leper cleansed', 'Matthew 8:1-4; Mark 1:40-45; Luke 5:12-16'],
    ['Paralytic lowered through the roof', 'Matthew 9:1-8; Mark 2:1-12; Luke 5:17-26'],
    ['Call of Matthew', 'Matthew 9:9-13; Mark 2:13-17; Luke 5:27-32'],
    ['Question about fasting', 'Matthew 9:14-17; Mark 2:18-22; Luke 5:33-39'],
    ['Healing at Bethesda', 'John 5:1-47'],
    ['Sabbath in the grainfields', 'Matthew 12:1-8; Mark 2:23-28; Luke 6:1-5'],
    ['Withered hand', 'Matthew 12:9-14; Mark 3:1-6; Luke 6:6-11'],
    ['The Twelve chosen', 'Mark 3:13-19; Luke 6:12-16; Matthew 10:1-4']
  ],
  E: [
    ['Sermon on the Mount', 'Matthew 5-7; Luke 6:17-49', { note: 'Luke records a shorter version, the Sermon on the Plain.' }]
  ],
  F: [
    ['Centurion’s servant', 'Matthew 8:5-13; Luke 7:1-10', { sub: 'Healing and authority' }],
    ['Widow’s son at Nain', 'Luke 7:11-17', { sub: 'Healing and authority' }],
    ['John’s question from prison', 'Matthew 11:2-19; Luke 7:18-35', { sub: 'Healing and authority' }],
    ['Woman anoints Jesus’ feet', 'Luke 7:36-50', { sub: 'Healing and authority' }],
    ['Women who followed Jesus', 'Luke 8:1-3', { sub: 'Healing and authority' }],
    ['Accused of using Beelzebul’s power', 'Matthew 12:22-37; Mark 3:20-30', { sub: 'Opposition' }],
    ['Sign of Jonah', 'Matthew 12:38-45', { sub: 'Opposition' }],
    ['Jesus’ true family', 'Matthew 12:46-50; Mark 3:31-35; Luke 8:19-21', { sub: 'Opposition' }],
    ['Parables of the kingdom', 'Matthew 13:1-52; Mark 4:1-34; Luke 8:4-18', { sub: 'Parables of the kingdom' }],
    ['Calming the storm', 'Matthew 8:23-27; Mark 4:35-41; Luke 8:22-25', { sub: 'Nature and demons' }],
    ['Gadarene demoniac', 'Matthew 8:28-34; Mark 5:1-20; Luke 8:26-39', { sub: 'Nature and demons' }],
    ['Jairus’s daughter and the woman with bleeding', 'Matthew 9:18-26; Mark 5:21-43; Luke 8:40-56', { sub: 'Raising and healing' }],
    ['Two blind men, the mute demoniac', 'Matthew 9:27-34', { sub: 'Raising and healing' }],
    ['Rejection at Nazareth, second visit', 'Matthew 13:53-58; Mark 6:1-6', { sub: 'Mission' }],
    ['The Twelve sent out', 'Matthew 9:35-11:1; Mark 6:7-13; Luke 9:1-6', { sub: 'Mission' }],
    ['Herod and the death of John', 'Matthew 14:1-12; Mark 6:14-29; Luke 9:7-9', { sub: 'Mission' }],
    ['Feeding the 5,000', 'Matthew 14:13-21; Mark 6:30-44; Luke 9:10-17; John 6:1-15', { sub: 'Mission' }],
    ['Walking on water', 'Matthew 14:22-33; Mark 6:45-52; John 6:16-21', { sub: 'Mission' }],
    ['Bread of Life', 'John 6:22-71', { sub: 'Mission' }],
    ['Tradition and clean and unclean', 'Matthew 15:1-20; Mark 7:1-23', { sub: 'Mission' }],
    ['Syrophoenician woman, deaf man, feeding the 4,000', 'Matthew 15:21-39; Mark 7:24-8:10', { sub: 'Mission' }],
    ['Pharisees’ leaven, blind man at Bethsaida', 'Matthew 16:1-12; Mark 8:11-26', { sub: 'Mission' }]
  ],
  G: [
    ['Peter’s confession, first passion prediction', 'Matthew 16:13-28; Mark 8:27-9:1; Luke 9:18-27'],
    ['Transfiguration', 'Matthew 17:1-13; Mark 9:2-13; Luke 9:28-36'],
    ['Boy with a demon', 'Matthew 17:14-21; Mark 9:14-29; Luke 9:37-43'],
    ['Second passion prediction', 'Matthew 17:22-23; Mark 9:30-32; Luke 9:43-45'],
    ['Temple tax', 'Matthew 17:24-27'],
    ['Greatness, humility, forgiveness', 'Matthew 18:1-35; Mark 9:33-50; Luke 9:46-50']
  ],
  H: [
    ['Departure and the Seventy sent', 'Luke 9:51-10:24'],
    ['Feast of Tabernacles', 'John 7:1-10:21', { note: 'John 7:53-8:11 is absent from the earliest manuscripts.' }],
    ['Luke’s travel teaching', 'Luke 10:25-13:21'],
    ['Feast of Dedication', 'John 10:22-42'],
    ['The journey continues', 'Luke 13:22-17:10'],
    ['Raising of Lazarus', 'John 11:1-54'],
    ['The road to Jericho', 'Luke 17:11-19:27; Matthew 19:1-20:34; Mark 10:1-52']
  ],
  I: [
    ['Anointing at Bethany', 'John 12:1-11; Matthew 26:6-13; Mark 14:3-9'],
    ['Triumphal entry', 'Matthew 21:1-11; Mark 11:1-11; Luke 19:28-44; John 12:12-19'],
    ['Fig tree and temple cleansing', 'Matthew 21:12-22; Mark 11:12-26; Luke 19:45-48'],
    ['Authority questioned, parables, controversies', 'Matthew 21:23-22:46; Mark 11:27-12:44; Luke 20:1-21:4'],
    ['Woes on the Pharisees', 'Matthew 23:1-39'],
    ['Olivet Discourse', 'Matthew 24-25; Mark 13:1-37; Luke 21:5-38'],
    ['The plot and Judas’s agreement', 'Matthew 26:1-5, 14-16; Mark 14:1-2, 10-11; Luke 22:1-6'],
    ['Last Supper and foot washing', 'Matthew 26:17-30; Mark 14:12-26; Luke 22:7-30; John 13:1-30'],
    ['Upper Room discourse', 'John 13:31-16:33'],
    ['High priestly prayer', 'John 17:1-26'],
    ['Gethsemane', 'Matthew 26:36-46; Mark 14:32-42; Luke 22:39-46; John 18:1'],
    ['Arrest of Jesus', 'Matthew 26:47-56; Mark 14:43-52; Luke 22:47-53; John 18:2-12'],
    ['Jewish trial and Peter’s denial', 'Matthew 26:57-75; Mark 14:53-72; Luke 22:54-71; John 18:13-27'],
    ['Roman trial', 'Matthew 27:1-26; Mark 15:1-15; Luke 23:1-25; John 18:28-19:16'],
    ['Crucifixion and death', 'Matthew 27:27-56; Mark 15:16-41; Luke 23:26-49; John 19:17-37'],
    ['Burial and the guard', 'Matthew 27:57-66; Mark 15:42-47; Luke 23:50-56; John 19:38-42']
  ],
  J: [
    ['The empty tomb', 'Matthew 28:1-10; Mark 16:1-8; Luke 24:1-12; John 20:1-18'],
    ['The guards’ report', 'Matthew 28:11-15'],
    ['Road to Emmaus', 'Luke 24:13-35'],
    ['Appearances in Jerusalem, Thomas', 'Luke 24:36-43; John 20:19-31'],
    ['Breakfast by the sea', 'John 21:1-25'],
    ['The Great Commission', 'Matthew 28:16-20'],
    ['The ascension', 'Luke 24:44-53; Mark 16:9-20', { note: 'Mark 16:9-20 is absent from the earliest manuscripts.' }]
  ]
};

/**
 * Parses a passage string such as "Matthew 26:1-5, 14-16; Luke 6:17-49" into the Gospel chapters it touches.
 * Used by the outline-integrity test to prove all 89 Gospel chapters are covered by at least one event.
 * @param {string} str
 * @returns {{book:string,chapter:number}[]}
 */
function rpPassageChapters(str) {
  var out = [];
  String(str).split(';').forEach(function(part) {
    var m = part.trim().match(/^([A-Za-z]+)\s+(.+)$/);
    if (!m || !RP_GOSPEL_CODES[m[1]]) return;
    var code = RP_GOSPEL_CODES[m[1]], lastCh = null;
    m[2].split(',').forEach(function(tok) {
      var t = tok.trim().match(/^(\d+)(?::(\d+))?(?:-(\d+)(?::(\d+))?)?$/);
      if (!t) return;
      var a = +t[1], hasColon = t[2] !== undefined, c = t[3] !== undefined ? +t[3] : null, d = t[4] !== undefined;
      var from, to;
      if (hasColon) { from = a; to = d ? c : a; lastCh = to; }
      else if (lastCh !== null) { return; }           // bare "14-16" after a colon token = verses of the same chapter
      else { from = a; to = c !== null ? c : a; lastCh = to; }
      for (var ch = from; ch <= to; ch++) out.push({ book: code, chapter: ch });
    });
  });
  return out;
}

function _slug(s) {
  return String(s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ── Compact group definitions ────────────────────────────────────────────────────────────
// Specs: [code, from, to]  = whole chapters;  [code, '18a'] = a split Acts item.
function R(code, from, to) { return [code, from, to === undefined ? from : to]; }
var PS_DAVID_1 = [R('Ps',3,9), R('Ps',11,28)];
var PS_DAVID_2 = [R('Ps',29,32), R('Ps',34,41), R('Ps',51,62)];
var PS_DAVID_3 = [R('Ps',63,65), R('Ps',68,70), R('Ps',86), R('Ps',101), R('Ps',103), R('Ps',108,110), R('Ps',122), R('Ps',124), R('Ps',131), R('Ps',133), R('Ps',138,145)];
var PS_OTHER_1 = [R('Ps',1,2), R('Ps',10), R('Ps',33), R('Ps',42,50), R('Ps',66,67), R('Ps',71,81)];
var PS_OTHER_2 = [R('Ps',82,85), R('Ps',87,100), R('Ps',102), R('Ps',104,107), R('Ps',111,113)];
var PS_OTHER_3 = [R('Ps',114,121), R('Ps',123), R('Ps',125,130), R('Ps',132), R('Ps',134,137), R('Ps',146,150)];

// [partId, partName, [ [groupId, groupName, specs | 'gospel:X', chron?] ]]
var RP_STORYFLOW_DEF = [
  ['p1', '1. Beginnings', [
    ['g.gen-1-11', 'Genesis 1–11', [R('Gen',1,11)]],
    ['g.job', 'Job', [R('Job',1,42)]],
    ['g.gen-12-50', 'Genesis 12–50', [R('Gen',12,50)]]
  ]],
  ['p2', '2. Exodus and Law', [
    ['g.exodus', 'Exodus', [R('Exod',1,40)]],
    ['g.leviticus', 'Leviticus', [R('Lev',1,27)]],
    ['g.numbers', 'Numbers', [R('Num',1,36)]],
    ['g.deuteronomy', 'Deuteronomy', [R('Deut',1,34)]]
  ]],
  ['p3', '3. Land', [
    ['g.joshua', 'Joshua', [R('Josh',1,24)]],
    ['g.judges-ruth', 'Judges and Ruth', [R('Judg',1,21), R('Ruth',1,4)]]
  ]],
  ['p4', '4. United Kingdom', [
    ['g.1-samuel', '1 Samuel', [R('1Sam',1,31)]],
    ['g.2-samuel', '2 Samuel', [R('2Sam',1,24)]],
    ['g.david-psalms-1', 'David’s Psalms (1 of 3)', PS_DAVID_1],
    ['g.david-psalms-2', 'David’s Psalms (2 of 3)', PS_DAVID_2],
    ['g.david-psalms-3', 'David’s Psalms (3 of 3)', PS_DAVID_3],
    ['g.1-chronicles', '1 Chronicles', [R('1Chr',1,29)], true],
    ['g.1-kings-1-11', '1 Kings 1–11', [R('1Kgs',1,11)]],
    ['g.2-chronicles-1-9', '2 Chronicles 1–9', [R('2Chr',1,9)], true],
    ['g.proverbs', 'Proverbs', [R('Prov',1,31)]],
    ['g.eccl-song', 'Ecclesiastes and Song of Solomon', [R('Eccl',1,12), R('Song',1,8)]]
  ]],
  ['p5', '5. Divided Kingdom', [
    ['g.kings-12-22-2k-1-17', '1 Kings 12–22 and 2 Kings 1–17', [R('1Kgs',12,22), R('2Kgs',1,17)]],
    ['g.2-chronicles-10-28', '2 Chronicles 10–28', [R('2Chr',10,28)], true],
    ['g.jonah-amos-hosea', 'Jonah, Amos, Hosea', [R('Jonah',1,4), R('Amos',1,9), R('Hos',1,14)]],
    ['g.isaiah-1-33', 'Isaiah 1–33', [R('Isa',1,33)]],
    ['g.isaiah-34-66-micah', 'Isaiah 34–66 and Micah', [R('Isa',34,66), R('Mic',1,7)]],
    ['g.2-kings-18-25', '2 Kings 18–25', [R('2Kgs',18,25)]],
    ['g.2-chronicles-29-36', '2 Chronicles 29–36', [R('2Chr',29,36)], true],
    ['g.nahum-zephaniah', 'Nahum and Zephaniah', [R('Nah',1,3), R('Zeph',1,3)]],
    ['g.jeremiah-1-26', 'Jeremiah 1–26', [R('Jer',1,26)]],
    ['g.jeremiah-27-52', 'Jeremiah 27–52', [R('Jer',27,52)]],
    ['g.lam-hab-obad', 'Lamentations, Habakkuk, Obadiah', [R('Lam',1,5), R('Hab',1,3), R('Obad',1,1)]]
  ]],
  ['p6', '6. Exile and Return', [
    ['g.ezekiel', 'Ezekiel', [R('Ezek',1,48)]],
    ['g.daniel', 'Daniel', [R('Dan',1,12)]],
    ['g.ezra-hag-zech', 'Ezra, Haggai, Zechariah', [R('Ezra',1,10), R('Hag',1,2), R('Zech',1,14)]],
    ['g.esther-neh-mal', 'Esther, Nehemiah, Malachi', [R('Esth',1,10), R('Neh',1,13), R('Mal',1,4)]],
    ['g.other-psalms-1', 'Other Psalms (1 of 3)', PS_OTHER_1],
    ['g.other-psalms-2', 'Other Psalms (2 of 3)', PS_OTHER_2],
    ['g.other-psalms-3', 'Other Psalms (3 of 3)', PS_OTHER_3],
    ['g.joel', 'Joel', [R('Joel',1,3)]]
  ]],
  ['p7', '7. Gospels', [
    ['g.gos-a', 'A. Prologue and birth', 'A'],
    ['g.gos-b', 'B. Preparation', 'B'],
    ['g.gos-c', 'C. Early ministry', 'C'],
    ['g.gos-d', 'D. Galilean ministry', 'D'],
    ['g.gos-e', 'E. Sermon on the Mount', 'E'],
    ['g.gos-f', 'F. Miracles, parables and mission', 'F'],
    ['g.gos-g', 'G. Turning point', 'G'],
    ['g.gos-h', 'H. Journey to Jerusalem', 'H'],
    ['g.gos-i', 'I. Passion Week', 'I'],
    ['g.gos-j', 'J. Resurrection and ascension', 'J']
  ]],
  ['p8', '8. Acts and the Letters', [
    ['g.acts-1-12', 'Acts 1–12', [R('Acts',1,12)]],
    ['g.acts-13-14-gal-jas', 'Acts 13–14, Galatians, James', [R('Acts',13,14), R('Gal',1,6), R('Jas',1,5)]],
    ['g.acts-15-18a-thess', 'Acts 15–18:17, 1–2 Thessalonians', [R('Acts',15,17), ['Acts','18a'], R('1Thess',1,5), R('2Thess',1,3)]],
    ['g.acts-18b-19-1cor', 'Acts 18:18–19, 1 Corinthians', [['Acts','18b'], R('Acts',19), R('1Cor',1,16)]],
    ['g.acts-20a-2cor-rom', 'Acts 20:1–3, 2 Corinthians, Romans', [['Acts','20a'], R('2Cor',1,13), R('Rom',1,16)]],
    ['g.acts-20b-28-prison', 'Acts 20:4–28, Ephesians, Philippians, Colossians, Philemon', [['Acts','20b'], R('Acts',21,28), R('Eph',1,6), R('Phil',1,4), R('Col',1,4), R('Phlm',1,1)]],
    ['g.pastoral', 'Pastoral letters', [R('1Tim',1,6), R('Titus',1,3), R('2Tim',1,4)]],
    ['g.general-letters', 'General letters', [R('Heb',1,13), R('1Pet',1,5), R('2Pet',1,3), R('Jude',1,1), R('1John',1,5), R('2John',1,1), R('3John',1,1)]],
    ['g.revelation', 'Revelation', [R('Rev',1,22)]]
  ]]
];

/** @returns {Object<string,{name:string,short:string,n:number}>} book info by code. */
function rpBookTable() {
  var t = {};
  RP_BOOKS.forEach(function(b) { t[b[0]] = { name: b[1], short: b[2], n: b[3] }; });
  return t;
}

/** Display label for a chapter or split item id, e.g. 'Isa.40' -> 'Isaiah 40'. */
function rpChapterLabel(book, chapter, books) {
  return books[book].name + ' ' + chapter;
}

/**
 * Builds the Story Flow plan: parts, groups and a flat item list in plan order.
 * @returns {Object} plan (see header comment)
 */
function rpBuildStoryFlow() {
  var books = rpBookTable();
  var plan = { id: 'storyflow', name: 'Story Flow', parts: [], groups: [], items: [], index: {} };
  RP_STORYFLOW_DEF.forEach(function(pd) {
    var part = { id: pd[0], name: pd[1], groups: [] };
    pd[2].forEach(function(gd) {
      var group = { id: gd[0], name: gd[1], partId: part.id, chron: !!gd[3], items: [], mixed: false };
      var specs = gd[2];
      if (typeof specs === 'string') {
        RP_EVENTS[specs].forEach(function(e) {
          var extra = e[2] || {};
          var item = { id: 'ev.' + _slug(e[0]), type: 'ev', label: e[0], passages: e[1], w: RP_W_EV };
          if (extra.note) item.note = extra.note;
          if (extra.sub) item.sub = extra.sub;
          group.items.push(item);
        });
      } else {
        var seenBooks = {};
        specs.forEach(function(sp) {
          var code = sp[0];
          seenBooks[code] = true;
          if (typeof sp[1] === 'string') {
            var s = RP_SPLITS[sp[1]];
            group.items.push({ id: code + '.' + sp[1], type: 'ch', book: code, label: s.label, short: s.short, w: RP_W_CH });
          } else {
            for (var ch = sp[1]; ch <= sp[2]; ch++) {
              group.items.push({ id: code + '.' + ch, type: 'ch', book: code, label: rpChapterLabel(code, ch, books), short: String(ch), w: RP_W_CH });
            }
          }
        });
        group.mixed = Object.keys(seenBooks).length > 1;
        if (group.mixed) group.items.forEach(function(it) { it.short = books[it.book].short + ' ' + it.short; });
      }
      part.groups.push(group);
      plan.groups.push(group);
      group.items.forEach(function(it) {
        it.partId = part.id; it.groupId = group.id; it.chron = group.chron;
        plan.index[it.id] = plan.items.length;
        plan.items.push(it);
      });
    });
    plan.parts.push(part);
  });
  return plan;
}

export {
  RP_BOOKS, RP_SPLITS, RP_EVENTS, RP_STORYFLOW_DEF, RP_W_CH, RP_W_EV,
  rpBuildStoryFlow, rpPassageChapters
};
