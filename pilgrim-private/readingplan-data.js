// readingplan-data.js — Pilgrim Private ES Module (v4.61.0)
// Reading Plans: the Story Flow outline as static data. NO imports, NO DOM, NO localStorage.
// Source: claude/spec-reading-plans-v1.md (Rev 2) + claude/spec-reading-plan-story-flow-outline-v1.md.
// Psalm placement (v4.59.0): claude/spec-psalms-story-placement-v1.md. All 150 Psalms sit by author and story position.
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
// ── Psalm placement (v4.59.0) ─────────────────────────────────────────────────────────────
// Source: claude/spec-psalms-story-placement-v1.md. Each Psalm is read where it fits the story.
// Rows are [psalm number, author key, basis]. Basis: A = heading names the event, B = author's era,
// C = content ties it to a setting, C* = weaker content tie, D = no datable setting (grouped by author).
// Basis is data only (not shown in the app); the outline test uses it to check the spec's counts.
// Psalm item IDs stay Ps.1 to Ps.150, so saved checks never move.
var PS_AUTHORS = { d: 'David', a: 'Anonymous', as: 'Asaph', k: 'Korah', s: 'Solomon', m: 'Moses', e: 'Ethan', kh: 'Korah / Heman' };

/** Psalms placed right AFTER a chapter, in reading order. Key = '<book code>.<chapter>'. */
var PS_AFTER = {
  'Gen.2': [[104,'a','C']],
  'Exod.15': [[114,'a','C']],
  'Deut.33': [[90,'m','B']],
  '1Sam.2': [[113,'a','C*']],
  '1Sam.7': [[99,'a','C']],
  '1Sam.16': [[8,'d','C*'],[19,'d','C*'],[23,'d','C*'],[29,'d','C*']],
  '1Sam.17': [[144,'d','C*']],
  '1Sam.19': [[59,'d','A']],
  '1Sam.21': [[34,'d','A'],[56,'d','A']],
  '1Sam.22': [[142,'d','A'],[57,'d','A'],[52,'d','A']],
  '1Sam.23': [[54,'d','A'],[31,'d','C*']],
  '1Sam.24': [[7,'d','C*']],
  '1Sam.26': [[11,'d','C*'],[13,'d','C*'],[17,'d','C*'],[35,'d','C*']],
  '2Sam.5': [[133,'d','C*'],[122,'d','C*'],[124,'d','C*']],
  '2Sam.6': [[15,'d','C*'],[24,'d','C'],[68,'d','C'],[101,'d','C*'],[131,'d','C*']],
  '2Sam.7': [[2,'a','C'],[110,'d','C']],
  '2Sam.8': [[60,'d','A'],[108,'d','C']],
  '2Sam.10': [[20,'d','C*'],[21,'d','C*']],
  '2Sam.12': [[51,'d','A'],[32,'d','C'],[38,'d','C*'],[6,'d','C*'],[103,'d','C*']],
  '2Sam.15': [[3,'d','A'],[4,'d','C'],[41,'d','C*'],[55,'d','C*']],
  '2Sam.17': [[63,'d','C*'],[61,'d','C*'],[62,'d','C*'],[143,'d','C*']],
  '2Sam.22': [[18,'d','A']],
  // After 2 Samuel 23 comes the David cluster (PS_CLUSTERS.david), its own group
  '2Sam.24': [[30,'d','C*']],
  '1Chr.16': [[96,'a','A'],[105,'a','A'],[106,'a','A'],[50,'as','B'],[73,'as','B'],[81,'as','B']],
  '1Kgs.2': [[37,'d','C*'],[71,'a','C*']],
  '1Kgs.3': [[72,'s','B']],
  '1Kgs.6': [[127,'s','B']],
  '1Kgs.8': [[132,'a','C'],[84,'k','C*'],[87,'k','C*']],
  'Song.8': [[45,'k','C*'],[49,'k','B'],[88,'kh','B']],
  '2Kgs.17': [[77,'as','B'],[78,'as','C'],[80,'as','C']],
  '2Chr.19': [[82,'as','C*']],
  '2Chr.20': [[83,'as','C'],[47,'k','C*']],
  '2Kgs.19': [[46,'k','C'],[48,'k','C'],[76,'as','C'],[75,'as','C*']],
  'Lam.5': [[74,'as','C'],[79,'as','C'],[44,'k','C*'],[89,'e','C']],
  'Ezek.48': [[137,'a','C'],[102,'a','C*'],[42,'k','C*'],[43,'a','C*']],
  'Ezra.2': [[107,'a','C'],[126,'a','C'],[120,'a','C*'],[121,'a','C*'],[123,'a','C*'],[125,'a','C*'],[128,'a','C*'],[129,'a','C*'],[130,'a','C*'],[134,'a','C*']],
  'Ezra.3': [[136,'a','C']],
  'Ezra.6': [[85,'k','C']],
  'Ezra.7': [[1,'a','C*'],[119,'a','C*']],
  'Neh.8': [[118,'a','C*']],
  'Neh.12': [[146,'a','C*'],[147,'a','C*'],[148,'a','C*'],[149,'a','C*'],[150,'a','C*']]
  // After Malachi 4 comes the anonymous cluster (PS_CLUSTERS.anon), its own group
};

/** Psalms with no datable setting, grouped by author. Each is its own collapsible group. */
var PS_CLUSTERS = {
  david: { authorDefault: 'David', rows: [[5,'d','D'],[9,'d','D'],[12,'d','D'],[14,'d','D'],[16,'d','D'],[22,'d','D'],[25,'d','D'],[26,'d','D'],[27,'d','D'],[28,'d','D'],
    [36,'d','D'],[39,'d','D'],[40,'d','D'],[53,'d','D'],[58,'d','D'],[64,'d','D'],[65,'d','D'],[69,'d','D'],[70,'d','D'],[86,'d','D'],[109,'d','D'],[138,'d','D'],
    [139,'d','D'],[140,'d','D'],[141,'d','D'],[145,'d','D'],[10,'a','D'],[33,'a','D']] },   // 10 and 33 are anonymous but travel with 9 and 32
  anon: { authorDefault: 'Anonymous', rows: [[66,'a','D'],[67,'a','D'],[91,'a','D'],[92,'a','D'],[93,'a','D'],[94,'a','D'],[95,'a','D'],[97,'a','D'],[98,'a','D'],[100,'a','D'],
    [111,'a','D'],[112,'a','D'],[115,'a','D'],[116,'a','D'],[117,'a','D'],[135,'a','D']] }
};

// [partId, partName, [ [groupId, groupName, specs | gospel letter | 'psalms:<cluster>', chron?] ]]
// Psalms are not listed in the chapter specs: they are woven in after their anchor chapters (PS_AFTER).
var RP_STORYFLOW_DEF = [
  ['p1', '1. Beginnings', [
    ['g.gen-1-11', 'Genesis 1–11 and Psalm 104', [R('Gen',1,11)]],
    ['g.job', 'Job', [R('Job',1,42)]],
    ['g.gen-12-50', 'Genesis 12–50', [R('Gen',12,50)]]
  ]],
  ['p2', '2. Exodus and Law', [
    ['g.exodus', 'Exodus and Psalm 114', [R('Exod',1,40)]],
    ['g.leviticus', 'Leviticus', [R('Lev',1,27)]],
    ['g.numbers', 'Numbers', [R('Num',1,36)]],
    ['g.deuteronomy', 'Deuteronomy and Psalm 90', [R('Deut',1,34)]]
  ]],
  ['p3', '3. Land', [
    ['g.joshua', 'Joshua', [R('Josh',1,24)]],
    ['g.judges-ruth', 'Judges and Ruth', [R('Judg',1,21), R('Ruth',1,4)]]
  ]],
  ['p4', '4. United Kingdom', [
    ['g.1-samuel', '1 Samuel and Psalms', [R('1Sam',1,31)]],
    ['g.2-samuel', '2 Samuel 1–23 and Psalms', [R('2Sam',1,23)]],
    ['g.david-psalms-undated', 'David’s Psalms with no datable setting', 'psalms:david'],
    ['g.2-samuel-24', '2 Samuel 24 and Psalm 30', [R('2Sam',24)]],
    ['g.1-chronicles', '1 Chronicles and Psalms', [R('1Chr',1,29)], true],
    ['g.1-kings-1-11', '1 Kings 1–11 and Psalms', [R('1Kgs',1,11)]],
    ['g.2-chronicles-1-9', '2 Chronicles 1–9', [R('2Chr',1,9)], true],
    ['g.proverbs', 'Proverbs', [R('Prov',1,31)]],
    ['g.eccl-song', 'Ecclesiastes, Song of Solomon and Psalms', [R('Eccl',1,12), R('Song',1,8)]]
  ]],
  ['p5', '5. Divided Kingdom', [
    ['g.kings-12-22-2k-1-17', '1 Kings 12–22, 2 Kings 1–17 and Psalms', [R('1Kgs',12,22), R('2Kgs',1,17)]],
    ['g.2-chronicles-10-28', '2 Chronicles 10–28 and Psalms', [R('2Chr',10,28)], true],
    ['g.jonah-amos-hosea', 'Jonah, Amos, Hosea', [R('Jonah',1,4), R('Amos',1,9), R('Hos',1,14)]],
    ['g.isaiah-1-33', 'Isaiah 1–33', [R('Isa',1,33)]],
    ['g.isaiah-34-66-micah', 'Isaiah 34–66 and Micah', [R('Isa',34,66), R('Mic',1,7)]],
    ['g.2-kings-18-25', '2 Kings 18–25 and Psalms', [R('2Kgs',18,25)]],
    ['g.2-chronicles-29-36', '2 Chronicles 29–36', [R('2Chr',29,36)], true],
    ['g.nahum-zephaniah', 'Nahum and Zephaniah', [R('Nah',1,3), R('Zeph',1,3)]],
    ['g.jeremiah-1-26', 'Jeremiah 1–26', [R('Jer',1,26)]],
    ['g.jeremiah-27-52', 'Jeremiah 27–52', [R('Jer',27,52)]],
    ['g.lam-hab-obad', 'Lamentations, Habakkuk, Obadiah and Psalms', [R('Lam',1,5), R('Hab',1,3), R('Obad',1,1)]]
  ]],
  ['p6', '6. Exile and Return', [
    ['g.ezekiel', 'Ezekiel and Psalms', [R('Ezek',1,48)]],
    ['g.daniel', 'Daniel', [R('Dan',1,12)]],
    ['g.ezra-hag-zech', 'Ezra, Haggai, Zechariah and Psalms', [R('Ezra',1,10), R('Hag',1,2), R('Zech',1,14)]],
    ['g.esther-neh-mal', 'Esther, Nehemiah, Malachi and Psalms', [R('Esth',1,10), R('Neh',1,13), R('Mal',1,4)]],
    ['g.anon-psalms', 'Songs of the people: anonymous Psalms', 'psalms:anon'],
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

function _isChron(it) { return it.book === '1Chr' || it.book === '2Chr'; }

/** A Psalm item: same shape as a chapter item plus its author and placement basis. */
function _psItem(row, books) {
  return { id: 'Ps.' + row[0], type: 'ch', book: 'Ps', label: rpChapterLabel('Ps', row[0], books), short: String(row[0]),
    w: RP_W_CH, author: PS_AUTHORS[row[1]], basis: row[2] };
}

/**
 * Builds the Story Flow plan: parts, groups and a flat item list in plan order.
 * @returns {Object} plan (see header comment)
 */
function rpBuildStoryFlow() {
  var books = rpBookTable();
  var plan = { id: 'storyflow', name: 'The Biblical Story', parts: [], groups: [], items: [], index: {},
    // Plan metadata shown in the plan's "About this plan" section; every plan in a future library carries its own.
    about: {
      title: 'The Biblical Story',
      by: 'Jesse Caldwell',
      date: 'Nov 1, 2026',
      intro: [
        'The books of the Bible are not arranged in the order the story happened, so reading straight through can leave the pieces disconnected. This plan places the Bible in a progression close to chronological order, so the story is easier to follow.',
        'I made some of the placement choices myself, based on my own judgment, because a few books (Job, Chronicles, the Psalms and the prophets) don\u2019t always fit cleanly into the flow. Here is how I arranged them:'
      ],
      list: [
        'Job is read among the patriarchs.',
        'Each prophet is read beside the king he served.',
        'Chronicles comes right after the Samuel and Kings history it retells.',
        'Each Psalm is read where it fits the story: right after the event named in its heading when it has one, otherwise by its author or by what it describes. Psalms with no clear setting are gathered in two groups, David\u2019s after 2 Samuel and the rest after Malachi.',
        'The four Gospels are woven into one life of Jesus, and organized event by event.',
        'Paul\u2019s letters are read where they fit in Acts.'
      ],
      outro: [
        'Every chapter appears once. You can check chapters off as you read, skip ahead whenever you like, and use Last Read to find your place.',
        'I hope this plan helps you follow the story that God has woven through His Word, and see how much He loves us.'
      ],
      note: RP_PROTO_NOTE
    } };
  RP_STORYFLOW_DEF.forEach(function(pd) {
    var part = { id: pd[0], name: pd[1], groups: [] };
    pd[2].forEach(function(gd) {
      var group = { id: gd[0], name: gd[1], partId: part.id, chron: !!gd[3], items: [], mixed: false };
      var specs = gd[2];
      if (typeof specs === 'string' && specs.indexOf('psalms:') === 0) {
        var cl = PS_CLUSTERS[specs.slice(7)];
        group.authorDefault = cl.authorDefault;
        group.psalms = true;
        cl.rows.forEach(function(row) { group.items.push(_psItem(row, books)); });
      } else if (typeof specs === 'string') {
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
              var after = PS_AFTER[code + '.' + ch];
              if (after) { seenBooks.Ps = true; after.forEach(function(row) { group.items.push(_psItem(row, books)); }); }
            }
          }
        });
        group.mixed = Object.keys(seenBooks).length > 1;
        if (group.mixed) group.items.forEach(function(it) { it.short = books[it.book].short + ' ' + it.short; });
      }
      // A group is a Chronicles group only if it holds nothing else; Psalms placed inside the two mixed
      // Chronicles groups are not Chronicles (the hide-Chronicles math in readingplan-core.js is per item).
      group.chron = group.chron && group.items.every(_isChron);
      part.groups.push(group);
      plan.groups.push(group);
      group.items.forEach(function(it) {
        it.partId = part.id; it.groupId = group.id; it.chron = _isChron(it);
        plan.index[it.id] = plan.items.length;
        plan.items.push(it);
      });
    });
    plan.parts.push(part);
  });
  return plan;
}


// ══ Plan library (v4.61.0) ═══════════════════════════════════════════════════════════════════
// Source: claude/spec-reading-plan-library-v1.md (Rev 3) + claude/spec-reading-plan-about-texts-v1.md (approved Nov 2, 2026).
// Every plan is built from code, never stored; only progress and the per-plan "enrolled" option are stored (readingplan.js).
// Plan ids are PERMANENT. Item ids inside different plans may repeat (e.g. 'Gen.1'); progress is per plan.
var RP_ABOUT_DATE = 'Nov 2, 2026';
var RP_PROTO_NOTE = 'This plan is a prototype. It is not an authoritative study plan, only one that I put together, and I know it can be improved. Your feedback and suggestions are welcome.';

/** Ordered list shown in Browse plans. `blurb` is the one-line summary on the card. */
var RP_PLAN_LIST = [
  { id: 'storyflow', name: 'The Biblical Story', blurb: 'The whole Bible in story order: Job among the patriarchs, each prophet beside his king, the Psalms where they fit, and the Gospels as one life of Jesus.' },
  { id: 'life-of-jesus', name: 'The Life of Jesus', blurb: 'The four Gospels woven into one account, event by event, from His birth to His ascension.' },
  { id: 'canon', name: 'Genesis to Revelation', blurb: 'Straight through the Bible in book order, one chapter at a time.' },
  { id: 'nt', name: 'The New Testament', blurb: 'Matthew 1 to Revelation 22, one chapter at a time.' },
  { id: 'acts-letters', name: 'Acts and the Letters', blurb: 'Paul’s letters read beside the part of Acts where they fit.' },
  { id: 'ot-story', name: 'The Old Testament Story', blurb: 'The Old Testament in a near-chronological order, from creation to Malachi.' }
];

var RP_ABOUTS = {
  'life-of-jesus': { title: "The Life of Jesus", by: 'Jesse Caldwell', date: RP_ABOUT_DATE,
      intro: ["The four Gospels tell one life from four angles, and reading them one after another means meeting the same events again and again. This plan weaves Matthew, Mark, Luke and John into a single account of Jesus, organized event by event, from His birth to His resurrection and ascension.",
        "Each event lists every Gospel passage that tells it, so you can read them together and see what each writer adds."],
      list: [],
      outro: ["You can check events off as you finish them, skip ahead whenever you like, and use Last Read to find your place. I hope this plan helps you see Jesus more clearly and love Him more."],
      note: RP_PROTO_NOTE },
  'canon': { title: "Genesis to Revelation", by: 'Jesse Caldwell', date: RP_ABOUT_DATE,
      intro: ["This plan takes you straight through the Bible in the order the books are arranged, from Genesis 1 to Revelation 22, one chapter at a time. It is the simplest way to read the whole thing, and every chapter appears once.",
        "Two long books are divided so no section feels endless: the Psalms are read in their five books, and Isaiah is read in two halves (chapters 1 to 39, and 40 to 66). Acts is read straight through, without the letters placed inside it."],
      list: [],
      outro: ["You can check chapters off as you read, skip ahead whenever you like, and use Last Read to find your place. I hope this plan helps you read all of God’s Word and see how it fits together."],
      note: RP_PROTO_NOTE },
  'nt': { title: "The New Testament", by: 'Jesse Caldwell', date: RP_ABOUT_DATE,
      intro: ["This plan reads the New Testament from Matthew 1 to Revelation 22, one chapter at a time, in the order the books are arranged: the Gospels, Acts, Paul’s letters and the other letters, and Revelation.",
        "If you want the Gospels as one story, or the letters placed inside Acts, the Life of Jesus and Acts and the Letters plans do that. This plan simply goes straight through."],
      list: [],
      outro: ["You can check chapters off as you read, skip ahead whenever you like, and use Last Read to find your place. I hope this plan helps you grow in the good news of Jesus and in the life of His church."],
      note: RP_PROTO_NOTE },
  'acts-letters': { title: "Acts and the Letters", by: 'Jesse Caldwell', date: RP_ABOUT_DATE,
      intro: ["Acts tells the story of the early church, and Paul wrote many of his letters while it was happening. This plan reads them together, so each letter sits next to the part of Acts where it was written.",
        "This is the same arrangement as the last part of The Biblical Story, on its own. Acts is divided into short sections so the letters can be read at the point they fit. Each chapter appears once."],
      list: [],
      outro: ["You can check chapters off as you read, skip ahead whenever you like, and use Last Read to find your place. I hope this plan helps you see the early church the way those first believers lived it."],
      note: RP_PROTO_NOTE },
  'ot-story': { title: "The Old Testament Story", by: 'Jesse Caldwell', date: RP_ABOUT_DATE,
      intro: ["The books of the Old Testament are not arranged in the order the story happened. This plan reads the Old Testament in a progression close to chronological order, from creation to Malachi, so the story is easier to follow.",
        "It uses the same arrangement as The Biblical Story, without the New Testament:"],
      list: ["Job is read among the patriarchs.",
        "Each prophet is read beside the king he served.",
        "Chronicles comes right after the Samuel and Kings history it retells.",
        "Each Psalm is read where it fits the story, and the Psalms with no clear setting are gathered in two groups."],
      outro: ["Every chapter appears once. You can check chapters off as you read, skip ahead whenever you like, and use Last Read to find your place. I hope this plan helps you see the story God was telling before Jesus came."],
      note: RP_PROTO_NOTE }
};

/** A slice of The Biblical Story: the chosen parts, same item ids, same order. Single-part slices drop the part number. */
function _sliceStory(id, name, partIds) {
  var base = rpBuildStoryFlow();
  var plan = { id: id, name: name, parts: [], groups: [], items: [], index: {}, about: RP_ABOUTS[id] };
  base.parts.forEach(function(p) {
    if (partIds.indexOf(p.id) < 0) return;
    var part = { id: p.id, name: partIds.length === 1 ? p.name.replace(/^\d+\.\s*/, '') : p.name, groups: p.groups };
    plan.parts.push(part);
    p.groups.forEach(function(g) {
      plan.groups.push(g);
      g.items.forEach(function(it) { plan.index[it.id] = plan.items.length; plan.items.push(it); });
    });
  });
  return plan;
}

// Canon parts: [id, name, first book index, last book index] into RP_BOOKS.
var RP_CANON_PARTS = [
  ['c1', 'Law', 0, 4], ['c2', 'History', 5, 16], ['c3', 'Wisdom and Poetry', 17, 21], ['c4', 'Prophets', 22, 38],
  ['c5', 'Gospels and Acts', 39, 43], ['c6', 'Letters', 44, 64], ['c7', 'Revelation', 65, 65]
];
// Two long books are divided so no group is endless (Psalms by its five books, Isaiah in two halves).
var RP_CANON_SPLITS = { Ps: [[1, 41], [42, 72], [73, 89], [90, 106], [107, 150]], Isa: [[1, 39], [40, 66]] };
var RP_CANON_BUNDLE_MAX = 45;   // small books are bundled in canon order up to about this many chapters
var RP_CANON_OWN_MIN = 20;      // a book with at least this many chapters is its own group

/** Every chapter in canon order (Acts whole), grouped by book, small books bundled. `partDefs` picks the parts. */
function _buildCanon(id, name, partDefs) {
  var books = rpBookTable();
  var plan = { id: id, name: name, parts: [], groups: [], items: [], index: {}, about: RP_ABOUTS[id] };
  partDefs.forEach(function(pd) {
    var part = { id: pd[0], name: pd[1], groups: [] };
    var bundle = [], bundleN = 0;
    function addGroup(gid, gname, segs) {
      var group = { id: gid, name: gname, partId: part.id, chron: false, items: [], mixed: segs.length > 1 };
      segs.forEach(function(s) {
        for (var ch = s[1]; ch <= s[2]; ch++) {
          var b = books[s[0]];
          group.items.push({ id: s[0] + '.' + ch, type: 'ch', book: s[0], label: b.name + ' ' + ch,
            short: (group.mixed ? b.short + ' ' : '') + ch, w: RP_W_CH, partId: part.id, groupId: gid, chron: false });
        }
      });
      part.groups.push(group);
      plan.groups.push(group);
      group.items.forEach(function(it) { plan.index[it.id] = plan.items.length; plan.items.push(it); });
    }
    function flush() {
      if (!bundle.length) return;
      var first = bundle[0][0], last = bundle[bundle.length - 1][0];
      var nm = bundle.length === 1 ? books[first].name : bundle.length === 2 ? books[first].name + ' and ' + books[last].name : books[first].name + ' to ' + books[last].name;
      addGroup('g.' + first + (last !== first ? '-' + last : ''), nm, bundle);
      bundle = []; bundleN = 0;
    }
    for (var bi = pd[2]; bi <= pd[3]; bi++) {
      var code = RP_BOOKS[bi][0], n = RP_BOOKS[bi][3];
      if (RP_CANON_SPLITS[code]) {
        flush();
        RP_CANON_SPLITS[code].forEach(function(r) { addGroup('g.' + code + '-' + r[0] + '-' + r[1], books[code].name + ' ' + r[0] + '–' + r[1], [[code, r[0], r[1]]]); });
      } else if (n >= RP_CANON_OWN_MIN) {
        flush();
        addGroup('g.' + code, books[code].name, [[code, 1, n]]);
      } else {
        if (bundleN + n > RP_CANON_BUNDLE_MAX) flush();
        bundle.push([code, 1, n]); bundleN += n;
      }
    }
    flush();
    plan.parts.push(part);
  });
  return plan;
}

/**
 * Builds any plan in the library by id.
 * @param {string} id - one of RP_PLAN_LIST
 * @returns {Object|null} plan (same shape as rpBuildStoryFlow), or null for an unknown id
 */
function rpBuildPlan(id) {
  var name = (RP_PLAN_LIST.filter(function(p) { return p.id === id; })[0] || {}).name;
  switch (id) {
    case 'storyflow': return rpBuildStoryFlow();
    case 'life-of-jesus': return _sliceStory(id, name, ['p7']);
    case 'acts-letters': return _sliceStory(id, name, ['p8']);
    case 'ot-story': return _sliceStory(id, name, ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
    case 'canon': return _buildCanon(id, name, RP_CANON_PARTS);
    case 'nt': return _buildCanon(id, name, RP_CANON_PARTS.slice(4));
  }
  return null;
}

export {
  RP_BOOKS, RP_SPLITS, RP_EVENTS, RP_STORYFLOW_DEF, RP_W_CH, RP_W_EV, PS_AFTER, PS_CLUSTERS, PS_AUTHORS,
  rpBuildStoryFlow, rpPassageChapters, RP_PLAN_LIST, RP_CANON_PARTS, rpBuildPlan
};
