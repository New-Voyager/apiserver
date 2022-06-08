'use strict';
const MANIFEST = 'flutter-app-manifest';
const TEMP = 'flutter-temp-cache';
const CACHE_NAME = 'flutter-app-cache';
const RESOURCES = {
  "version.json": "12b9b3af6fe2c51322cbe5bbb521a971",
"index.html": "ba4e81e4807935a16da1b9c4be11dcfe",
"/": "ba4e81e4807935a16da1b9c4be11dcfe",
"main.dart.js": "2adffbefca5c857ba3529701e9ff3d17",
"flutter.js": "0816e65a103ba8ba51b174eeeeb2cb67",
"favicon.png": "5dcef449791fa27946b3d35ad8803796",
"icons/Icon-192.png": "ac9a721a12bbc803b44f645561ecb1e1",
"icons/Icon-maskable-192.png": "c457ef57daa1d16f64b27b786ec2ea3c",
"icons/Icon-maskable-512.png": "301a7604d45b3e739efc881eb04896ea",
"icons/Icon-512.png": "96e752610906ba2a93c65f8abe1645f1",
"manifest.json": "6dbe13ec70383258e671883f0047ea28",
"assets/AssetManifest.json": "0d76adcb107478af668e65d3260b74ad",
"assets/NOTICES": "bb399cff1ab8a2fec0fe2630a5cf0c1e",
"assets/FontManifest.json": "9aaae38f14a8fcd2fbcffd19be5c3f10",
"assets/packages/flutter_math_fork/lib/katex_fonts/fonts/KaTeX_AMS-Regular.ttf": "657a5353a553777e270827bd1630e467",
"assets/packages/flutter_math_fork/lib/katex_fonts/fonts/KaTeX_Script-Regular.ttf": "55d2dcd4778875a53ff09320a85a5296",
"assets/packages/flutter_math_fork/lib/katex_fonts/fonts/KaTeX_Size3-Regular.ttf": "e87212c26bb86c21eb028aba2ac53ec3",
"assets/packages/flutter_math_fork/lib/katex_fonts/fonts/KaTeX_Typewriter-Regular.ttf": "87f56927f1ba726ce0591955c8b3b42d",
"assets/packages/flutter_math_fork/lib/katex_fonts/fonts/KaTeX_Caligraphic-Bold.ttf": "a9c8e437146ef63fcd6fae7cf65ca859",
"assets/packages/flutter_math_fork/lib/katex_fonts/fonts/KaTeX_SansSerif-Bold.ttf": "ad0a28f28f736cf4c121bcb0e719b88a",
"assets/packages/flutter_math_fork/lib/katex_fonts/fonts/KaTeX_Main-Bold.ttf": "9eef86c1f9efa78ab93d41a0551948f7",
"assets/packages/flutter_math_fork/lib/katex_fonts/fonts/KaTeX_Fraktur-Regular.ttf": "dede6f2c7dad4402fa205644391b3a94",
"assets/packages/flutter_math_fork/lib/katex_fonts/fonts/KaTeX_Main-Regular.ttf": "5a5766c715ee765aa1398997643f1589",
"assets/packages/flutter_math_fork/lib/katex_fonts/fonts/KaTeX_SansSerif-Italic.ttf": "d89b80e7bdd57d238eeaa80ed9a1013a",
"assets/packages/flutter_math_fork/lib/katex_fonts/fonts/KaTeX_Math-Italic.ttf": "a7732ecb5840a15be39e1eda377bc21d",
"assets/packages/flutter_math_fork/lib/katex_fonts/fonts/KaTeX_Main-Italic.ttf": "ac3b1882325add4f148f05db8cafd401",
"assets/packages/flutter_math_fork/lib/katex_fonts/fonts/KaTeX_Fraktur-Bold.ttf": "46b41c4de7a936d099575185a94855c4",
"assets/packages/flutter_math_fork/lib/katex_fonts/fonts/KaTeX_Size2-Regular.ttf": "959972785387fe35f7d47dbfb0385bc4",
"assets/packages/flutter_math_fork/lib/katex_fonts/fonts/KaTeX_SansSerif-Regular.ttf": "b5f967ed9e4933f1c3165a12fe3436df",
"assets/packages/flutter_math_fork/lib/katex_fonts/fonts/KaTeX_Size1-Regular.ttf": "1e6a3368d660edc3a2fbbe72edfeaa85",
"assets/packages/flutter_math_fork/lib/katex_fonts/fonts/KaTeX_Caligraphic-Regular.ttf": "7ec92adfa4fe03eb8e9bfb60813df1fa",
"assets/packages/flutter_math_fork/lib/katex_fonts/fonts/KaTeX_Size4-Regular.ttf": "85554307b465da7eb785fd3ce52ad282",
"assets/packages/flutter_math_fork/lib/katex_fonts/fonts/KaTeX_Main-BoldItalic.ttf": "e3c361ea8d1c215805439ce0941a1c8d",
"assets/packages/flutter_math_fork/lib/katex_fonts/fonts/KaTeX_Math-BoldItalic.ttf": "946a26954ab7fbd7ea78df07795a6cbc",
"assets/packages/cupertino_icons/assets/CupertinoIcons.ttf": "6d342eb68f170c97609e9da345464e5e",
"assets/packages/font_awesome_flutter/lib/fonts/fa-solid-900.ttf": "aa1ec80f1b30a51d64c72f669c1326a7",
"assets/packages/font_awesome_flutter/lib/fonts/fa-regular-400.ttf": "5178af1d278432bec8fc830d50996d6f",
"assets/packages/font_awesome_flutter/lib/fonts/fa-brands-400.ttf": "b37ae0f14cbc958316fac4635383b6e8",
"assets/packages/wakelock_web/assets/no_sleep.js": "7748a45cd593f33280669b29c2c8919a",
"assets/fonts/MaterialIcons-Regular.otf": "95db9098c58fd6db106f1116bae85a0b",
"assets/assets/images/club/member.svg": "387e6de665ec181802dea25e36097de7",
"assets/assets/images/club/rewards.svg": "d2956513e6daaffbf5a8091d6db85bbb",
"assets/assets/images/club/manage_chips.svg": "6fca03c5118c2665086c1bdeabe6fc21",
"assets/assets/images/club/game_history.svg": "d3325b29a3bf79c3b41d4271a8828a96",
"assets/assets/images/club/announcements.svg": "c61f3966c43875c0a9e75af973561fdd",
"assets/assets/images/club/bookmarks.svg": "c8c2c8591cef420f02c17d30b2485356",
"assets/assets/images/club/chat.svg": "b50b55797359fc79740b5e31c5562057",
"assets/assets/images/club/analysis.svg": "5968e841186868f719dacc84adc52995",
"assets/assets/images/club/sharedhands.svg": "02d0ca7bd6a0b643dc7a6966930668cf",
"assets/assets/images/club/message_host.svg": "34d6d92164716295ad32318b4d26b8f0",
"assets/assets/images/record.png": "e764b916417a8d1e6a2c3f6d2f871560",
"assets/assets/images/bet-widget/add.png": "bcd8e1cd02994f3e54450408a5b68bb2",
"assets/assets/images/bet-widget/add-sub-background.png": "dd54aeba61610918eef376db11c2f6f7",
"assets/assets/images/bet-widget/background.png": "f9c63193eb8033a351ce9c69764b3cb8",
"assets/assets/images/bet-widget/minus.png": "80f85d2f1d0685a9fceef888a46d2229",
"assets/assets/images/bet-widget/header.png": "d25335250ca033c90099b239e664cdc7",
"assets/assets/images/casino.png": "1030ab269ae55d455fe80e36b4ea5889",
"assets/assets/images/speak/speak-two.svg": "da59dcca269bc80d0d07b8892c6b2973",
"assets/assets/images/speak/speak-all.svg": "0aba7db127eff8374ce7c01209aa744e",
"assets/assets/images/speak/speak-all.png": "e17054bbead066492b9f0ec798c72538",
"assets/assets/images/speak/speak-two.png": "0971daacaa29fbbd9fc93b7a32ff94be",
"assets/assets/images/speak/speak-one.png": "ceba4c90b3cc51f03be121000f0d64a9",
"assets/assets/images/speak/clean_svgs.sh": "835553cfbc536326267df8ef2474b1c2",
"assets/assets/images/speak/speak-one.svg": "d5030de99803683b760197989b38f3d6",
"assets/assets/images/gamebutton2.svg": "e9c6409de89ffaecffff550d12b8ec25",
"assets/assets/images/game-screen/resume.svg": "a568dbfa3f1a87f0ff8046e114215f4e",
"assets/assets/images/game-screen/rearrange.svg": "80edd61f5563a532910715e4c8b0ea88",
"assets/assets/images/game-screen/terminate.svg": "07b5c30bd042b7f7d6f8e91760854d9a",
"assets/assets/images/game-screen/pause_bg.png": "f0d4086bd631a067ce76ca7b36d914a2",
"assets/assets/images/game-screen/done.svg": "e59065b638304e5e8fb04b495e0bc3cc",
"assets/assets/images/network_connectivity/network_disconnected.png": "7e0905db7f196ead0b4645a28975911b",
"assets/assets/images/betchips/sb.svg": "947bb0200111fa94e3557ea27d6df6b8",
"assets/assets/images/betchips/yellow.svg": "3dca608265734e26bc506a9497574388",
"assets/assets/images/betchips/raisebig.svg": "84b9a3d5fb37ef9b78ae25257790af0d",
"assets/assets/images/betchips/red.svg": "a5e7c145107bd2eb1452bffbc2813461",
"assets/assets/images/betchips/bet_chips_blue.svg": "eb49420c9f502a2b52f5cf1f4a87db32",
"assets/assets/images/betchips/callbig.svg": "5435ed1c6520c8f502d36d075bee059c",
"assets/assets/images/betchips/allin.svg": "186a7af6df976c8b98c9707f222e841d",
"assets/assets/images/betchips/straddle.svg": "57a94cacb0ad4e0e31a6cee36209733f",
"assets/assets/images/betchips/bb.svg": "57a94cacb0ad4e0e31a6cee36209733f",
"assets/assets/images/betchips/clean_svgs.sh": "835553cfbc536326267df8ef2474b1c2",
"assets/assets/images/betchips/green.svg": "337b11db285c8da0e19a5e1e5316411b",
"assets/assets/images/chip.svg": "f90f5b0c8542fc5fc77454827f010013",
"assets/assets/images/buttons/join.svg": "80b12d6f12ceb1ddb255f7cf5c50e082",
"assets/assets/images/name_plates/silver_name_plate.png": "32024889c825656783e94bee61e2ac5d",
"assets/assets/images/name_plates/gold_name_plate.png": "32d51681e1c62e5f70a427af599d13f5",
"assets/assets/images/name_plates/silver-nameplate.svg": "1e51205c759f702cd707a3d85f3acff2",
"assets/assets/images/name_plates/silver-nameplate.png": "63687d5a5c772bd308118b0bef222ee8",
"assets/assets/images/name_plates/default.svg": "71f9bd49c72c9096932d61e48a24bc52",
"assets/assets/images/name_plates/np4.svg": "420d897af8e00e5a53f196f34a68899a",
"assets/assets/images/name_plates/nameplate1.png": "82fcd4f83fc037955dfc0e0f0c117633",
"assets/assets/images/name_plates/gold-nameplate1.png": "eedebec5cec3aefea79cca6e78ef69ec",
"assets/assets/images/name_plates/np1.svg": "befad3b5d6aaa68435ebbf96ad99b2f2",
"assets/assets/images/name_plates/gold-nameplate.png": "eedebec5cec3aefea79cca6e78ef69ec",
"assets/assets/images/name_plates/np3.svg": "8a10139baa4ae9c59e18413bed3a79dd",
"assets/assets/images/name_plates/np2.svg": "79f75f9a901e4b49d0de01a16c1bfc02",
"assets/assets/images/remove_filter.svg": "4c5d36cc3b1af673aac7d5950368d195",
"assets/assets/images/launcher_icon.xcf": "cece1cb1b613f2f8c4f83255f8511f6d",
"assets/assets/images/appcoin.svg": "ea44c84b508942afa2dbd85f9a8e1da8",
"assets/assets/images/standing3.svg": "8d4b272594208c6c66828e9f522c2407",
"assets/assets/images/appcoin.png": "77c1a8a7a6934c51450f3d02b4168491",
"assets/assets/images/card_face/88.png": "34f440265ff4aee8e37c03e8fc61a31f",
"assets/assets/images/card_face/162.png": "6a4a4312f81bad561ec07dec89bbbab1",
"assets/assets/images/card_face/200.png": "68977729612df3015521bc82d30213db",
"assets/assets/images/card_face/177.png": "58ca86cbcbb4e36dc5da220889e6e926",
"assets/assets/images/card_face/104.svg": "d801d890730552630ab2cc986d313b06",
"assets/assets/images/card_face/161.png": "dd11ab89f2fd73197ad565b91dfc8ad5",
"assets/assets/images/card_face/49.png": "a4e11d646d793760b36f15c0f584461a",
"assets/assets/images/card_face/148.png": "2de5ed8e4b998f0297389c163d6a7957",
"assets/assets/images/card_face/113.svg": "a1dbfe4a8fa8d93275d3129d94d6c6a9",
"assets/assets/images/card_face/164.png": "b7b9b28b57462cf8cea07d96ab256b1f",
"assets/assets/images/card_face/65.png": "410259ba27b9184d72bb4788b658c0dc",
"assets/assets/images/card_face/17.svg": "7f36828ba5fee5d72826db11dec18d4f",
"assets/assets/images/card_face/116.svg": "ce3e55d4cd9f7e3ec31a3766f510b37a",
"assets/assets/images/card_face/114.svg": "db269db22d90469af9df68430859d0d5",
"assets/assets/images/card_face/100.svg": "db8db9d5fedc869674b249e7b25a993e",
"assets/assets/images/card_face/8.png": "6d86aee045b5a46d69ad8f64b62be70d",
"assets/assets/images/card_face/72.png": "716363deb424c3da8a0cfab008e6da36",
"assets/assets/images/card_face/66.png": "d44ee57f9a8c2565a77da3b0e0a6d66a",
"assets/assets/images/card_face/98.png": "dfeaa71089d8122894cc322adb83ef24",
"assets/assets/images/card_face/129.svg": "4d85ab2df88f26721c02034dc540babb",
"assets/assets/images/card_face/98.svg": "4c2a10a0014fe15c0e2e87d4fad12d2d",
"assets/assets/images/card_face/129.png": "6726b4ae04c1d3cfd963d3962307a32f",
"assets/assets/images/card_face/JOKER-1.svg": "1cd613c5d9638c432c0bd51440b9c2a9",
"assets/assets/images/card_face/100.png": "58777da0f52f6afd0f7a2889cad76423",
"assets/assets/images/card_face/114.png": "281da8cf92053672ca060ca49469fb90",
"assets/assets/images/card_face/66.svg": "ec1ed0ea91da8b8ed028a2f31dcb89d4",
"assets/assets/images/card_face/72.svg": "60993fe101075424058c89329002b966",
"assets/assets/images/card_face/8.svg": "a43d5d8c7fadce9cc6d16de207fe966c",
"assets/assets/images/card_face/116.png": "5f0ca451e3e31c92e2a9c57e01521dcf",
"assets/assets/images/card_face/JOKER-2.svg": "d9096d9601ee3666b77dec30e83a68c5",
"assets/assets/images/card_face/17.png": "b680fb0ae2d931235053e618be29ae40",
"assets/assets/images/card_face/JOKER-3.svg": "eae092cbc8f7e466b272ac6cdf1c6a98",
"assets/assets/images/card_face/65.svg": "fe87b526fbeff3d6e96f32f7dc891553",
"assets/assets/images/card_face/164.svg": "a1f643a02908665869db858180491d12",
"assets/assets/images/card_face/148.svg": "f16404fca8ded6bd528376f005764529",
"assets/assets/images/card_face/49.svg": "1d211d37a3e5cc84ddc1f735a852b141",
"assets/assets/images/card_face/113.png": "c453b63ad70be9d0ca0b0040115fbf95",
"assets/assets/images/card_face/161.svg": "08c76c7cc28cdc9a187389b85f108f39",
"assets/assets/images/card_face/177.svg": "0d3ff117dfe2ab080a82fdbb205ede52",
"assets/assets/images/card_face/104.png": "3c1e384370d4c4b39769262694343ba1",
"assets/assets/images/card_face/200.svg": "d035ee33f784a028bd8eb9cf42fab880",
"assets/assets/images/card_face/162.svg": "7f233676409cae662bf9e6720abf0b1b",
"assets/assets/images/card_face/88.svg": "a2d600e78cf35bfbfc39a57e8133466b",
"assets/assets/images/card_face/184.svg": "cf43760826ad402a0e7d0537620697a8",
"assets/assets/images/card_face/52.svg": "c3f189d6341d8c1f607a889adcc95cd5",
"assets/assets/images/card_face/120.png": "c207294041a41ace2cd4a4b3e170d47a",
"assets/assets/images/card_face/20.png": "5e00458a27ab9e3c144d3370b2b792d4",
"assets/assets/images/card_face/34.png": "dc96c974e17d45155e89f4a2b880bfa4",
"assets/assets/images/card_face/1.svg": "a1a98d0de8f301b33de6973fd38f0585",
"assets/assets/images/card_face/84.svg": "51b4d59e1ad4d61b3593974f24031ba1",
"assets/assets/images/card_face/146.svg": "2c8173c8649842bc54beee6d0b3a060e",
"assets/assets/images/card_face/152.svg": "355daeebd38d65e25cb56f3da67615ac",
"assets/assets/images/card_face/178.svg": "de5575460e187cae871c8101da689927",
"assets/assets/images/card_face/193.svg": "110355df2890f0cc529843143644c893",
"assets/assets/images/card_face/36.png": "7f661cce876bab26951f12e14283f387",
"assets/assets/images/card_face/136.png": "715a2ce4cb37ab20d1b2e801247f2743",
"assets/assets/images/card_face/2.svg": "9e8942488c374c7a68cad06c5a318606",
"assets/assets/images/card_face/50.svg": "cd6fc12928fe31c414b43a52a9d913e6",
"assets/assets/images/card_face/145.svg": "2a4d86c82a9239f5dd5a90a40ec6c4e9",
"assets/assets/images/card_face/97.svg": "a7ab1e2ea2aa8a1d3871cb2793611aab",
"assets/assets/images/card_face/40.svg": "20af042e844b343c0f98c28ead40b8bd",
"assets/assets/images/card_face/68.svg": "25ad7d5fd0861e495189f1c4e3aa47c7",
"assets/assets/images/card_face/196.svg": "64fd4903f6033b535b3a1abb3ba6cf80",
"assets/assets/images/card_face/132.png": "384c732e3ef18689b73060ce6f5e9ac5",
"assets/assets/images/card_face/33.png": "52bd9258163f58762729b3db67c34017",
"assets/assets/images/card_face/168.svg": "6664c7877d531ae46e14ad2e49063313",
"assets/assets/images/card_face/82.svg": "db1fa3cf80db0ada2066bb8c8d700e99",
"assets/assets/images/card_face/18.png": "8978d4a5151ef993fbdecd0c857869f6",
"assets/assets/images/card_face/24.png": "d85d16cb4e67675589401698df053f35",
"assets/assets/images/card_face/130.png": "9df30990bb67676a37a2f0185722bba4",
"assets/assets/images/card_face/180.svg": "6f7407cd79da654b27d39c8038766b13",
"assets/assets/images/card_face/194.svg": "9d1f6c1aaaed73ab50699379f4e0d830",
"assets/assets/images/card_face/4.svg": "a9993f6d045e05770bfbf27e9657306b",
"assets/assets/images/card_face/56.svg": "1f4961496731fe5554f8acb6c8f2dd20",
"assets/assets/images/card_face/81.svg": "58f8d1a1086fd3830e182a90ff0002eb",
"assets/assets/images/card_face/130.svg": "310a92d7c2ced822fdd381a5f1371996",
"assets/assets/images/card_face/81.png": "6e6a29d6bd40883fc7b85410864242d0",
"assets/assets/images/card_face/4.png": "2dd6c2625645bd163c83d577a6b3436b",
"assets/assets/images/card_face/56.png": "7c9a0bdc0cf778abc0be52616a335961",
"assets/assets/images/card_face/194.png": "284959f944094cb4caa4df987baa69bc",
"assets/assets/images/card_face/180.png": "a04e8335d126fd29f506c829641aa187",
"assets/assets/images/card_face/24.svg": "0f142c1305262dace5111af2b8f81377",
"assets/assets/images/card_face/18.svg": "996c377d30a7921a6634d5fc27a52f3a",
"assets/assets/images/card_face/82.png": "308335894367f0c98cdbbc537c5d7294",
"assets/assets/images/card_face/168.png": "0b5494e0fcf5565cc6a4bd3b281930e2",
"assets/assets/images/card_face/68.png": "3e02c58c273d9fca4d68ee4939a412c0",
"assets/assets/images/card_face/196.png": "82603bd8cdf0095ed34db41eabf6740f",
"assets/assets/images/card_face/40.png": "dfe174e4ad1a58c2869bc78a92f35e40",
"assets/assets/images/card_face/97.png": "e76a3cdb87436f18c0a279d9b5cd4851",
"assets/assets/images/card_face/33.svg": "3b2979dc8c29f4734635f03110b089a5",
"assets/assets/images/card_face/132.svg": "cbbf8012dd92dd7d5e8c4a52c6cd6757",
"assets/assets/images/card_face/136.svg": "fe46a4e03efab93355b8dc5a69e6f43b",
"assets/assets/images/card_face/145.png": "a53a20f94490f70d6db9c0f2599e74ac",
"assets/assets/images/card_face/2.png": "0309ab25b5fc6f22e5a89138718eba37",
"assets/assets/images/card_face/50.png": "544431a6b288e94343fbc9567ea2d0fd",
"assets/assets/images/card_face/193.png": "700dd113c406e3c261fb1b8ec8511ad2",
"assets/assets/images/card_face/178.png": "dd91befd51850eec82cd386b88195024",
"assets/assets/images/card_face/36.svg": "d4caf899cc6a01038c9c9d64dae5f9dc",
"assets/assets/images/card_face/34.svg": "ca72f7dc41c86cc2a93892fa06b3f217",
"assets/assets/images/card_face/20.svg": "6759ee608de322b2bb89bfad5549d388",
"assets/assets/images/card_face/152.png": "3abe814f31d5c7dcf3f0568bcdfd9c03",
"assets/assets/images/card_face/146.png": "c709fe5c9cddd902ca2d998782f5f0c7",
"assets/assets/images/card_face/84.png": "12aa95bdaecdc77ab0dfa74527aed341",
"assets/assets/images/card_face/1.png": "9ca2bb9cfd507faa79deaba2526ffe05",
"assets/assets/images/card_face/52.png": "93d76870777fe4eae921f342f9736e70",
"assets/assets/images/card_face/184.png": "9d85fc653b4d313a06cf8ffe42f63cb0",
"assets/assets/images/card_face/120.svg": "567ddb52c960b611d7f392369379b867",
"assets/assets/images/chips.png": "969a70aad858de0bc130f43af13efa88",
"assets/assets/images/host.svg": "87046143311095f7bccb1da854eb13f0",
"assets/assets/images/standing2.svg": "790b9be10ebef311ceb6d3ab3e8a5e6d",
"assets/assets/images/hostbutton.svg": "da86c607ea84f1425a564b91c9e9d61b",
"assets/assets/images/card_back/set2/Asset%25202.png": "308cdfc74c94218004ce2ec92f67677b",
"assets/assets/images/card_back/set2/Asset%25203.png": "1acbef40b1d5de6fd1b0e315ece35c86",
"assets/assets/images/card_back/set2/Asset%25201.png": "27661a9c954e58d10c179b5c976d4319",
"assets/assets/images/card_back/set2/Asset%25204.png": "dc47704f73fcd530ea2680af63dca9f1",
"assets/assets/images/card_back/set2/Asset%25205.png": "326b7befefe8dbd7edd39d714e843849",
"assets/assets/images/card_back/set2/Asset%25207.png": "f530a0ddff2075a6aea2d06d1098ab4c",
"assets/assets/images/card_back/set2/Asset%25206.png": "6ba69b127b58ba2fd16efecf580424f3",
"assets/assets/images/card_back/set2/Asset%25208.png": "11f6435c94b8b1c42e6e2cec7ab8ffb2",
"assets/assets/images/card_back/set1/Asset%25202.png": "118663a6650fbbc9463195f8c9d3d123",
"assets/assets/images/card_back/set1/Asset%25203.png": "bfea7df789616fdf017fef417df1c0b6",
"assets/assets/images/card_back/set1/Asset%25201.png": "9aaafc8632badf4fbf8d66383dfc7845",
"assets/assets/images/card_back/set1/Asset%25204.png": "2064cdf68a3cb94892eef95c468c7fe5",
"assets/assets/images/card_back/set1/Asset%25205.png": "300a68f76e2cdd868972342e16701d7c",
"assets/assets/images/card_back/set1/Asset%25207.png": "84bfe9542c6af48fea592cd6bbe7fa57",
"assets/assets/images/card_back/set1/Asset%25206.png": "f5a3dcabb7b0eeea0aa7aef94d6ad4c4",
"assets/assets/images/card_back/set1/Asset%25208.png": "02bcc93b11a8fc60200e02fdcd76bf6c",
"assets/assets/images/card_back/set1/Asset%25209.png": "13706730d07f860de18ae3dd5133a919",
"assets/assets/images/card_back/set1/Asset%252012.png": "f49fabc1f771823e3cf4b4b51c6a6e9f",
"assets/assets/images/card_back/set1/Asset%252010.png": "d35651f683d737e2cce3d129e125efe2",
"assets/assets/images/card_back/set1/Asset%252011.png": "a3e0de64eecce7882ce1d3897a17033c",
"assets/assets/images/cards/join.png": "09aa717dbc054dd6ac0bade7cdf591d3",
"assets/assets/images/cards/livegames_background_ORIGINAL.png": "0f671c0fb35b5598335ca98aa61a4db9",
"assets/assets/images/cards/spade.png": "0f9a79cef127ae94d45ab910251b503a",
"assets/assets/images/cards/5card-plo.png": "fcfa49396f6df60a1ed69bc30d015aa1",
"assets/assets/images/cards/5card-plo-hi-lo.png": "c127920e954c3b0b05e9e67a6d54509f",
"assets/assets/images/cards/heart.png": "6aea07c5d9b45acd37dc6e3192752145",
"assets/assets/images/cards/holdem.png": "9011364240f1973abe43add77ef72d24",
"assets/assets/images/cards/livegame_chip.png": "dd61acab8b2f8620f9ab648be0dbaab9",
"assets/assets/images/cards/plo.png": "17cfed9de97c0fd6d3ac221b0b7a1603",
"assets/assets/images/cards/heart2.png": "7b70ac5c38fa83cdb911effcdbbe8d49",
"assets/assets/images/cards/diamond.png": "7992253014b169387f01a286f28d5c41",
"assets/assets/images/cards/club.png": "b646a32916e0a4a8d26e36625a81a72c",
"assets/assets/images/cards/plo-hi-lo.png": "ef80448eb787a1546656713fc45dbc65",
"assets/assets/images/cards/livegames_background.png": "8a164d5e484043b59cbc1de86ce75698",
"assets/assets/images/seat.svg": "0f890d6f7e7f23fbde8b789327a7ff18",
"assets/assets/images/multiple-appcoin.svg": "4294f9fdfffdd41e3074ac62fa10ed54",
"assets/assets/images/slide_up.png": "6f577e7dca7302274c34da870353fd7d",
"assets/assets/images/livegames/join.png": "09aa717dbc054dd6ac0bade7cdf591d3",
"assets/assets/images/livegames/chip.svg": "974b28dc236c83449004694a568120cd",
"assets/assets/images/livegames/chip2.svg": "395f13622441c1932ffa44a17e014fff",
"assets/assets/images/livegames/listitem_bg.png": "0f671c0fb35b5598335ca98aa61a4db9",
"assets/assets/images/livegames/chip2.png": "fd4d982747171a1b333446e6dd7e7be8",
"assets/assets/images/livegames/chip.png": "dd61acab8b2f8620f9ab648be0dbaab9",
"assets/assets/images/livegames/livegame_bg.svg": "0419611c6fad0e847d857b4dea4ba5c7",
"assets/assets/images/standing1.svg": "7f55bec4159910b7a13d7ae03bd26050",
"assets/assets/images/handhistory.svg": "9de60b3321ba4599f1f2d9c22b826d20",
"assets/assets/images/casino.svg": "58f5d52b53793612b2d037feb381f427",
"assets/assets/images/game-settings/dealer.png": "3e8df1ef0bd51842003f4845cbd685cd",
"assets/assets/images/game-settings/roe_chip.svg": "bc642a789654953ee417543ddf03b79b",
"assets/assets/images/game-settings/dealer.svg": "0f08da808fba53d8432922d9d4b56a45",
"assets/assets/images/game-settings/next_arrow.svg": "2093dc271916e1930735a56d36b752e4",
"assets/assets/images/game-settings/roe.png": "52ff53aab21e76c760624764a0420333",
"assets/assets/images/game-settings/next_arrow.png": "fa03f484dd322337c586d3f691d94649",
"assets/assets/images/join.svg": "a7f3d2d51d3e2c5d4dc6c4e434ed6fed",
"assets/assets/images/default/betdial.png": "f8d211963aa3f722f075e0dfd47b4d4c",
"assets/assets/images/default/betdial1.svg": "e32bdb495343dfbed6513fd92d495c73",
"assets/assets/images/default/betdial.svg": "aa0eabc44d2915b011dd46b64d7e55de",
"assets/assets/images/default/cardface/Kc.svg": "cf43760826ad402a0e7d0537620697a8",
"assets/assets/images/default/cardface/preview.png": "3b65d693f455c10de69a1e33d5880367",
"assets/assets/images/default/cardface/2h.svg": "9e8942488c374c7a68cad06c5a318606",
"assets/assets/images/default/cardface/Jd.svg": "f16404fca8ded6bd528376f005764529",
"assets/assets/images/default/cardface/Js.svg": "2a4d86c82a9239f5dd5a90a40ec6c4e9",
"assets/assets/images/default/cardface/Kd.svg": "6f7407cd79da654b27d39c8038766b13",
"assets/assets/images/default/cardface/Ks.svg": "0d3ff117dfe2ab080a82fdbb205ede52",
"assets/assets/images/default/cardface/3h.svg": "996c377d30a7921a6634d5fc27a52f3a",
"assets/assets/images/default/cardface/Jc.svg": "355daeebd38d65e25cb56f3da67615ac",
"assets/assets/images/default/cardface/Qh.svg": "7f233676409cae662bf9e6720abf0b1b",
"assets/assets/images/default/cardface/Tc.svg": "fe46a4e03efab93355b8dc5a69e6f43b",
"assets/assets/images/default/cardface/7s.svg": "58f8d1a1086fd3830e182a90ff0002eb",
"assets/assets/images/default/cardface/4h.svg": "ca72f7dc41c86cc2a93892fa06b3f217",
"assets/assets/images/default/cardface/Ac.svg": "d035ee33f784a028bd8eb9cf42fab880",
"assets/assets/images/default/cardface/7d.svg": "51b4d59e1ad4d61b3593974f24031ba1",
"assets/assets/images/default/cardface/6c.svg": "60993fe101075424058c89329002b966",
"assets/assets/images/default/cardface/8h.svg": "4c2a10a0014fe15c0e2e87d4fad12d2d",
"assets/assets/images/default/cardface/9h.svg": "db269db22d90469af9df68430859d0d5",
"assets/assets/images/default/cardface/Ad.svg": "64fd4903f6033b535b3a1abb3ba6cf80",
"assets/assets/images/default/cardface/7c.svg": "a2d600e78cf35bfbfc39a57e8133466b",
"assets/assets/images/default/cardface/As.svg": "110355df2890f0cc529843143644c893",
"assets/assets/images/default/cardface/Ts.svg": "4d85ab2df88f26721c02034dc540babb",
"assets/assets/images/default/cardface/Td.svg": "cbbf8012dd92dd7d5e8c4a52c6cd6757",
"assets/assets/images/default/cardface/5h.svg": "cd6fc12928fe31c414b43a52a9d913e6",
"assets/assets/images/default/cardface/6s.svg": "fe87b526fbeff3d6e96f32f7dc891553",
"assets/assets/images/default/cardface/6d.svg": "25ad7d5fd0861e495189f1c4e3aa47c7",
"assets/assets/images/default/cardface/8c.svg": "d801d890730552630ab2cc986d313b06",
"assets/assets/images/default/cardface/5d.svg": "c3f189d6341d8c1f607a889adcc95cd5",
"assets/assets/images/default/cardface/6h.svg": "ec1ed0ea91da8b8ed028a2f31dcb89d4",
"assets/assets/images/default/cardface/5s.svg": "1d211d37a3e5cc84ddc1f735a852b141",
"assets/assets/images/default/cardface/9d.svg": "ce3e55d4cd9f7e3ec31a3766f510b37a",
"assets/assets/images/default/cardface/9s.svg": "a1dbfe4a8fa8d93275d3129d94d6c6a9",
"assets/assets/images/default/cardface/4c.svg": "20af042e844b343c0f98c28ead40b8bd",
"assets/assets/images/default/cardface/Ah.svg": "9d1f6c1aaaed73ab50699379f4e0d830",
"assets/assets/images/default/cardface/Th.svg": "310a92d7c2ced822fdd381a5f1371996",
"assets/assets/images/default/cardface/5c.svg": "1f4961496731fe5554f8acb6c8f2dd20",
"assets/assets/images/default/cardface/8d.svg": "db8db9d5fedc869674b249e7b25a993e",
"assets/assets/images/default/cardface/8s.svg": "a7ab1e2ea2aa8a1d3871cb2793611aab",
"assets/assets/images/default/cardface/4d.svg": "d4caf899cc6a01038c9c9d64dae5f9dc",
"assets/assets/images/default/cardface/4s.svg": "3b2979dc8c29f4734635f03110b089a5",
"assets/assets/images/default/cardface/7h.svg": "db1fa3cf80db0ada2066bb8c8d700e99",
"assets/assets/images/default/cardface/9c.svg": "567ddb52c960b611d7f392369379b867",
"assets/assets/images/default/cardface/2c.svg": "a43d5d8c7fadce9cc6d16de207fe966c",
"assets/assets/images/default/cardface/Qd.svg": "a1f643a02908665869db858180491d12",
"assets/assets/images/default/cardface/Qs.svg": "08c76c7cc28cdc9a187389b85f108f39",
"assets/assets/images/default/cardface/Kh.svg": "de5575460e187cae871c8101da689927",
"assets/assets/images/default/cardface/3d.svg": "6759ee608de322b2bb89bfad5549d388",
"assets/assets/images/default/cardface/3s.svg": "7f36828ba5fee5d72826db11dec18d4f",
"assets/assets/images/default/cardface/Qc.svg": "6664c7877d531ae46e14ad2e49063313",
"assets/assets/images/default/cardface/2d.svg": "a9993f6d045e05770bfbf27e9657306b",
"assets/assets/images/default/cardface/2s.svg": "a1a98d0de8f301b33de6973fd38f0585",
"assets/assets/images/default/cardface/Jh.svg": "2c8173c8649842bc54beee6d0b3a060e",
"assets/assets/images/default/cardface/3c.svg": "0f142c1305262dace5111af2b8f81377",
"assets/assets/images/default/backdrop.png": "c1010270f9f5a15a80ce199a4a08c4ca",
"assets/assets/images/default/clean_svgs.sh": "835553cfbc536326267df8ef2474b1c2",
"assets/assets/images/default/table.png": "0335354e6dfa2ba1918817ee4947f11d",
"assets/assets/images/default/cardback.png": "11f6435c94b8b1c42e6e2cec7ab8ffb2",
"assets/assets/images/cardicon.svg": "9d3e92d187b0ef8376b5098b4a5144bb",
"assets/assets/images/game/greenchip.svg": "7f689d3f2daded26deb74941544a63f0",
"assets/assets/images/game/straddle%2520chips.svg": "122772894e4a9b63cb7f79762d488d9a",
"assets/assets/images/game/whitechip.svg": "58758072e297ddbac162edd4dbdaf8f5",
"assets/assets/images/game/sb.svg": "13d5a7adb201c672206bd4ee3a90edc8",
"assets/assets/images/game/tasks.svg": "36250225a2b8d567476add877af3cbac",
"assets/assets/images/game/lock.svg": "ccb9775ae4d9303969ae109db883b817",
"assets/assets/images/game/bigbet.svg": "0eeb55ceaf26f3dcc0b0f3b3fa2a492a",
"assets/assets/images/game/clipboard.svg": "07e2c8081ac524d122fe387f09563e3c",
"assets/assets/images/game/gold%2520bb.svg": "34a7d232fb8ffab6f0336e51a5a6eaf6",
"assets/assets/images/game/goldchip.svg": "4a0c3a87a10355b76f22547ed7e50cf6",
"assets/assets/images/game/handhistory.svg": "adaa83779d259a874a7d642a45ff43a0",
"assets/assets/images/game/sb%2520chip-1.svg": "ffecbfbf7749226690e529f03ce15c24",
"assets/assets/images/game/chat2.svg": "1af82df1ed86706bbc7b50113183e77b",
"assets/assets/images/game/raisebig.svg": "b06dca966f5b21c26a64632c40798ff8",
"assets/assets/images/game/bet%2520chips2.svg": "3656e12f1169b218f222c54f4eb244c9",
"assets/assets/images/game/conf-on.svg": "5c046731637c3318b812e1e6417ea61c",
"assets/assets/images/game/gold-flat.svg": "891482eb67f469cf58681587ba981dca",
"assets/assets/images/game/join-conf.svg": "499232f4f6cf0f34ce896f1d7d5af410",
"assets/assets/images/game/mic.svg": "3718e2a2f272a9eb4a6e636788d8a2b9",
"assets/assets/images/game/bigbet-2.svg": "8ed47563bb020898584fabefb05c7cbf",
"assets/assets/images/game/bomb1.svg": "cea419138630f8d5dca5e10ea129c75e",
"assets/assets/images/game/flame.png": "55018ae5d2c5d7ad70dab46a5451df41",
"assets/assets/images/game/chat.svg": "18abd29bc529bd07018a4dd5f0cd275b",
"assets/assets/images/game/callbig.svg": "f4ae98cb4f048c1c697955db9d85c5e8",
"assets/assets/images/game/player-stats.svg": "b7933bbc4667deba7c97ce838917998c",
"assets/assets/images/game/lasthand.svg": "83f98c00e5f35e90ad0e92c8122525c1",
"assets/assets/images/game/sb%2520chip.svg": "90a1acf66178dba6d814957837bce5ee",
"assets/assets/images/game/straddle.svg": "61dc15f86555e27e7f636571606b5944",
"assets/assets/images/game/bet-chip.svg": "8f3161feea0f2d3da40712e9ac60d04b",
"assets/assets/images/game/bb.svg": "d8d2e5ea02f1f595641d6add7fa9d181",
"assets/assets/images/game/break.svg": "c45abbb02b5f229bed04dad6589bdb06",
"assets/assets/images/game/mic-mute.svg": "4c6975d6bc5b74c41708b85b809c9252",
"assets/assets/images/game/bet%2520chips.svg": "cea44f5e0c73f23a094728c8e45b8fde",
"assets/assets/images/game/mic-step1.svg": "5d0bb553fcc803fe0817730b8e6b5e55",
"assets/assets/images/game/green%2520bet.svg": "efe5ae878e38a69e0f7ef29199b0f559",
"assets/assets/images/game/mic-step0.svg": "3718e2a2f272a9eb4a6e636788d8a2b9",
"assets/assets/images/game/bigbet1.svg": "83ce11e84009a91c38d484b94697a225",
"assets/assets/images/game/transfer-up.svg": "6cb35a86cd7166eababb9e775f7796bf",
"assets/assets/images/game/mic-step2.svg": "ec272307de8cd60d87c541508106f683",
"assets/assets/images/game/mic-step3.svg": "389140db4e0da0e1e18aa66223dc0ce8",
"assets/assets/images/game/memberactivities.svg": "4448ac7054558f2f7df0c79ecca45b7c",
"assets/assets/images/game/bb%2520chips.svg": "e1da79b2d9f39c247bfe5c174f0909f3",
"assets/assets/images/game/conf-off.svg": "3c56cae67153d7ca0b9c6f6287fc48ab",
"assets/assets/images/game/highhand.svg": "f111cdfc590bc58d188c410b62e3179d",
"assets/assets/images/trophy.svg": "652b862ab89ab758538bdc757681c6bf",
"assets/assets/images/rabbit.svg": "cea2ff652731dcdd4f95faf8b9808b14",
"assets/assets/images/coins.svg": "5e07ded804df6356d6fc668ff67cfa83",
"assets/assets/images/backgrounds/western%2520saloon.png": "2c5f5b98a77e0a90291c9d6dcc804ab9",
"assets/assets/images/backgrounds/night%2520sky.png": "c1010270f9f5a15a80ce199a4a08c4ca",
"assets/assets/images/backgrounds/new_background.png": "2dea208d7004404c0eb636dffd118593",
"assets/assets/images/backgrounds/bg5.jpg": "3af9c49d93b0aefa4c819060c85c1095",
"assets/assets/images/backgrounds/bar_bookshelf_light.jpg": "f06aa578b53054e71bd8501319e0041c",
"assets/assets/images/backgrounds/livegame_list.svg": "0419611c6fad0e847d857b4dea4ba5c7",
"assets/assets/images/backgrounds/chat-background.png": "c4ff1a8348dfd41857359fbe9b7c1e5b",
"assets/assets/images/splash1.png": "f376b847644ebe0ad8c758ba67c26ab5",
"assets/assets/images/splash.png": "8e131df548968e85fd31dfa0fbfcea44",
"assets/assets/images/gamesettings/group.svg": "692107dfc1064c5604de306b54cff024",
"assets/assets/images/gamesettings/Group%2520300.svg": "889ee0adeca1639bd46f2597e63792ba",
"assets/assets/images/gamesettings/casino.svg": "c36af9bf2fb31f54e51d4e273a87191b",
"assets/assets/images/gamesettings/pie-chart.svg": "e96b5ea9039bf535ce028967dea4e6a2",
"assets/assets/images/gamesettings/card.svg": "33e007a7285a4eb1a0b71e19cf60f9b5",
"assets/assets/images/gamesettings/bigblind.svg": "fd93dacd5c4df1eb7f7376a86f9cfb84",
"assets/assets/images/gamesettings/message.svg": "4fb96ef3f678ddd5ae267bd96dc1bc47",
"assets/assets/images/gamesettings/chat.svg": "859c1b7cbec66f011fa05691b6a61b83",
"assets/assets/images/gamesettings/coin.svg": "3fc3e877eaee777aff1cce3e2198ce2b",
"assets/assets/images/gamesettings/coin-stack.svg": "a2e90341276158171879c8d4a2e40610",
"assets/assets/images/gamesettings/Group%2520295.svg": "bbf0c2c67f522f34ade1500d5be03784",
"assets/assets/images/gamesettings/gambling.svg": "f91d5ed1b02bef5a6bd48b155cc2b8f4",
"assets/assets/images/gamesettings/clock.svg": "99097e3e4eecbcc5a4b7cfa637dcb132",
"assets/assets/images/gamesettings/membership.svg": "e2b12186e4f4bb20509b34b93beb2100",
"assets/assets/images/gamesettings/history.svg": "37cca508fa02e8751931e4289f0c3fae",
"assets/assets/images/gamebutton.svg": "7b2b955b643eaf04bb9ddb7e71ffda7f",
"assets/assets/images/player-stats.svg": "84f9ca0e9c6666d7f734c092325b25d7",
"assets/assets/images/logo.png": "cfedc4376525cc533a8b09903efa14b1",
"assets/assets/images/table/night%2520sky%2520table.png": "cb0cdcd542d14c8bad1ac71fe768017a",
"assets/assets/images/table/rustic%2520table.png": "5df54b782cc6a90e7e4f7df911b197c8",
"assets/assets/images/table/vertical.png": "7de6ace1440fadf63d01c0de18897956",
"assets/assets/images/table/new_vertical.png": "640bf45aaeb2a33a1db3b9d4c611db08",
"assets/assets/images/table/redtable.png": "9f4e7c75430a14033ecf90b96c3dd69e",
"assets/assets/images/table/darkgreen.png": "ea019db05128d5de0309185d8a211f5d",
"assets/assets/images/ioslogo.png": "3c7f8fbc6f5e27c867c623dea8155433",
"assets/assets/images/backarrow.svg": "c3154c3c538b8d6e73b7f6bca43e997f",
"assets/assets/images/lasthand.svg": "653c21cc0f88b08d34c743a1f99c7073",
"assets/assets/images/joinbutton.svg": "bc489630639cdeac6396b78727a70621",
"assets/assets/images/edit.svg": "66bce9960bf481f1fc53229efa223131",
"assets/assets/images/appcoins.png": "c253962c0f61928358fbdf19e37e2ee6",
"assets/assets/images/bottom_pattern.png": "4f4003202000cdc32ef93f0e4955a864",
"assets/assets/images/diamond.svg": "1900674dfd2b0745949357ebbb3619fd",
"assets/assets/images/attributions/tenor.png": "81c9546499b1a178fab6c47aebbb8a37",
"assets/assets/images/attributions/tenor_original.png": "e0acf7c07cd454e9d67b42c831ebf201",
"assets/assets/images/filter.svg": "0062840947f31426082e2a3d936fe8a1",
"assets/assets/images/customize.svg": "1220e209ab01212877a1cbd9f1da7024",
"assets/assets/images/push-notification.png": "b0bf0112099cb4c0fd163b817b554e64",
"assets/assets/images/seatchange.svg": "93f9442bdbf9e2db22fe6395827aba80",
"assets/assets/images/betimage.svg": "c9cd335fdd8e5afd6f9a763479af9268",
"assets/assets/images/live.png": "bdbd8afcf7c8cc6366d569b7df0aca78",
"assets/assets/images/color-card_face/Kc.svg": "e1f76ebb14097fc37aff3344c2f97d6e",
"assets/assets/images/color-card_face/2h.svg": "6355a4803010cf53eebf86ea0316248e",
"assets/assets/images/color-card_face/Jd.svg": "300684294470394ff71b7b5c5eed93ea",
"assets/assets/images/color-card_face/Js.svg": "6607a94c86d4cab879e26eb88c748b0d",
"assets/assets/images/color-card_face/Kd.svg": "ad0683bb1ecf5c8c71a0470d89490731",
"assets/assets/images/color-card_face/Ks.svg": "a085f317eb4d5fa78538f0881ce5795c",
"assets/assets/images/color-card_face/3h.svg": "0a7de63e88edda911204c075d31b0ba6",
"assets/assets/images/color-card_face/Jc.svg": "11d68337999263ab20f47b8ebd083769",
"assets/assets/images/color-card_face/Qh.svg": "005540459d85cbbdfcbf8819fb3982f6",
"assets/assets/images/color-card_face/Tc.svg": "e2d8a010b1f9f8e89c5fccd00fa133b0",
"assets/assets/images/color-card_face/7s.svg": "aa91942bfeddfb65a6fe163c580bf493",
"assets/assets/images/color-card_face/4h.svg": "4a9ef09f36d45c3f7f65ddc97a888a20",
"assets/assets/images/color-card_face/Ac.svg": "3d0b8ad67683bde8183a3214fa9da87e",
"assets/assets/images/color-card_face/7d.svg": "dfd1e5dc04a8a7628d399ef09cf5999e",
"assets/assets/images/color-card_face/6c.svg": "01fbc04e81a268ae6d5512955e18727f",
"assets/assets/images/color-card_face/8h.svg": "c470267ddeb460907b644655c9ff5131",
"assets/assets/images/color-card_face/9h.svg": "5da041cbe4cc20bc277d00c4ab5f78f9",
"assets/assets/images/color-card_face/Ad.svg": "d9d04cdeebd279bac00b7cf115b1dd80",
"assets/assets/images/color-card_face/7c.svg": "bbbc335e2dbfd77429e4ddd2f0bb84f5",
"assets/assets/images/color-card_face/As.svg": "6dff603150734d0bab242f85d307b734",
"assets/assets/images/color-card_face/Ts.svg": "488dab628c6ab4cc8985edabcddc55cd",
"assets/assets/images/color-card_face/Td.svg": "a2d55180d5e5c33d85ea7f061a6c2a81",
"assets/assets/images/color-card_face/5h.svg": "a67c227c8209d3a9ad82e66e113604a4",
"assets/assets/images/color-card_face/6s.svg": "7672d45381f6341cc4c256ed7f6fc397",
"assets/assets/images/color-card_face/6d.svg": "204045dbf1e58ade2d5491f53ce21f21",
"assets/assets/images/color-card_face/8c.svg": "715122eb5a1e59ec5b9920ccdef1e7f5",
"assets/assets/images/color-card_face/5d.svg": "9509209cf9db996f41623558b41f7a50",
"assets/assets/images/color-card_face/6h.svg": "eb857c43dc2d4182d7117c277b22c116",
"assets/assets/images/color-card_face/5s.svg": "3164556202a9c219168f9d8785751598",
"assets/assets/images/color-card_face/9d.svg": "38d2c9111a698bc00bfed64214bd9fdb",
"assets/assets/images/color-card_face/9s.svg": "b80fb52917b64425100bda89f0f239c6",
"assets/assets/images/color-card_face/4c.svg": "e69345a1a59a702c1f04a632bc4b1465",
"assets/assets/images/color-card_face/Ah.svg": "d98267fbb6cb4dcc614217f8f448cfa0",
"assets/assets/images/color-card_face/Th.svg": "1b85f727366f859ef28fb16ea294f174",
"assets/assets/images/color-card_face/5c.svg": "464c2e818a26e05ea6e0f3e1d178e3e2",
"assets/assets/images/color-card_face/8d.svg": "ccd708e6f1fe492f824fc04dcbe2d941",
"assets/assets/images/color-card_face/8s.svg": "5ec6d8b559ee2cd430dc2805dd2df4d6",
"assets/assets/images/color-card_face/4d.svg": "ec17793dc973df7f992db99bfdcb7b93",
"assets/assets/images/color-card_face/4s.svg": "8cd3f3cd8d09f6cecb8bab396cad803c",
"assets/assets/images/color-card_face/7h.svg": "bc777f36ce71aeca1322f0112d878f29",
"assets/assets/images/color-card_face/9c.svg": "b3cd9a1375ece0397598890fb8e6ebee",
"assets/assets/images/color-card_face/2c.svg": "3f9fa708e1985c28dfee79f45f6c0f00",
"assets/assets/images/color-card_face/Qd.svg": "ee5f0b599c48b7ef56ba7b25c804fdfb",
"assets/assets/images/color-card_face/Qs.svg": "eb7a6787a59fa5dc9890d6b4a2d87c85",
"assets/assets/images/color-card_face/Kh.svg": "a4c5b2f59f0c3c6a211a518fc0d9b857",
"assets/assets/images/color-card_face/3d.svg": "5e2d62e07104b04604812cba9b68daa9",
"assets/assets/images/color-card_face/3s.svg": "521abb78ff039781e547e5bbf6c969a4",
"assets/assets/images/color-card_face/Qc.svg": "9a2126f5a201ab233a9a54fe93a3ee56",
"assets/assets/images/color-card_face/2d.svg": "676a42d1337160538fea5ac6f41e97bf",
"assets/assets/images/color-card_face/2s.svg": "901d2b10dbfc927c484d966c9bda8c97",
"assets/assets/images/color-card_face/Jh.svg": "9f2d4007a08a8ecf3fe534f9f6ee5f25",
"assets/assets/images/color-card_face/3c.svg": "985fa1f43667b489846cb1a950394b25",
"assets/assets/images/highhand.svg": "8f3bd92b16891703e3609ee62c008598",
"assets/assets/language/en.json": "e111cf4357c0e50ce0c38bfa65a4cd65",
"assets/assets/json/nameplates.json": "1483384e8ffb65adb063e7698bbfe4d5",
"assets/assets/json/mockdata.json": "a3453166c10e1622fca473487cc04b20",
"assets/assets/sound_effects/button_press.mp3": "5ee88cf8a0fd8b7e93c5458184635826",
"assets/assets/sound_effects/pitch4.mp3": "60ad10cd5ae22d9ee04eb81b743295ff",
"assets/assets/sound_effects/turn.mp3": "8e2a1ca99014b0b7acd34cab5729a876",
"assets/assets/sound_effects/applause.mp3": "006331003375abd9a48caab4dc83cb79",
"assets/assets/sound_effects/flop.mp3": "6ea2a41fdcff114a9896d0c6da36ae74",
"assets/assets/sound_effects/pitch1.mp3": "906421d232df6c072673c0260500b1d0",
"assets/assets/sound_effects/pitch.mp3": "dfb1e9de4b5057a7aeeb3c9bea685329",
"assets/assets/sound_effects/pitch2.mp3": "3c5053a3ffc373d83f3b5a02d9137714",
"assets/assets/sound_effects/allin.mp3": "af4b2a529255315c638fe4921f979a96",
"assets/assets/sound_effects/pitch3.mp3": "853b08b448c5fad20aead383ca02e1ff",
"assets/assets/sound_effects/clock_ticking.mp3": "8b499c9cc2bb27c9ad8854a4b79b2481",
"assets/assets/sound_effects/bet_call1.mp3": "9b63df029f804ed8aa5bc06f329d5b0c",
"assets/assets/sound_effects/ping.mp3": "224881621e63c7c2db7ada3f8294f1af",
"assets/assets/sound_effects/new_chat_text_message.mp3": "98a6d9ee3ad03a6db87989b1c4226926",
"assets/assets/sound_effects/fold.mp3": "b5c451991cfee508c7ad6dd175ba441a",
"assets/assets/sound_effects/deal.mp3": "c008016b20b2571073b52c740154b3ab",
"assets/assets/sound_effects/new_hand.mp3": "3000f01c8c5f953a986a340eaa5c9396",
"assets/assets/sound_effects/fireworks.mp3": "f26332bb373321b55195e994414adb8e",
"assets/assets/sound_effects/check.mp3": "584f9f5b206dadeea30e2e749bf16be0",
"assets/assets/sound_effects/player_turn.mp3": "24d391162ca795042803765147120d1a",
"assets/assets/sound_effects/river.mp3": "94c85766ec8f1a606020f5098ec4ef45",
"assets/assets/icons/club_screen_icons.ttf": "486a07b30041e0e3636d4fffdc0d8672",
"assets/assets/icons/contacthost.svg": "4d092a8d11bb0709074d906e4deee891",
"assets/assets/icons/clubs.svg": "19f3c79ccb1a457fd8431eb06232bfbc",
"assets/assets/icons/app_icons.ttf": "21bd06dd92e7abc943cb72a07032fea3",
"assets/assets/icons/chat.svg": "e0596923b4a6fa2676576e05b388d9de",
"assets/assets/icons/critical.svg": "fe25bf1ea9ed826655af0de7ce31a050",
"assets/assets/icons/analysis.svg": "4330499e262503ddcfd0eca22d20d794",
"assets/assets/icons/potpokerchips.svg": "7228c91c463c964697fcd143fafab8bc",
"assets/assets/fonts/Lato-Thin.ttf": "9a77fbaa85fa42b73e3b96399daf49c5",
"assets/assets/fonts/SourceSerifPro-SemiBold.ttf": "b883eaa137d26dec7a3e210a67fedc37",
"assets/assets/fonts/Lato-Bold.ttf": "85d339d916479f729938d2911b85bf1f",
"assets/assets/fonts/Lato-Black.ttf": "e631d2735799aa943d93d301abf423d2",
"assets/assets/fonts/Poppins-Light.ttf": "f6ea751e936ade6edcd03a26b8153b4a",
"assets/assets/fonts/Lato-Regular.ttf": "2d36b1a925432bae7f3c53a340868c6e",
"assets/assets/fonts/Trocchi-Regular.ttf": "5b6205c119ad223b200029701a1e75fe",
"assets/assets/fonts/Rockwell-Regular.ttf": "fcca3a4a6df1ab46dd94c73f2e912fde",
"assets/assets/fonts/Literata-Bold.ttf": "e927d855c9fdd81b7d6ee0cfb7b5f7bf",
"assets/assets/fonts/Rockwell-Bold.ttf": "b302ceccfeb4062f4128d9e07f67c210",
"assets/assets/fonts/Poppins-Regular.ttf": "8b6af8e5e8324edfd77af8b3b35d7f9c",
"assets/assets/fonts/Domine-VariableFont_wght.ttf": "c8e8b1526bc5a6ba19cbcfeb0934cada",
"assets/assets/fonts/Lato-Light.ttf": "2fe27d9d10cdfccb1baef28a45d5ba90",
"assets/assets/fonts/Poppins-Bold.ttf": "a3e0b5f427803a187c1b62c5919196aa",
"assets/assets/fonts/NoticiaText-Bold.ttf": "5368866b60f3e26cb4cc4deff1b772fc",
"assets/assets/animations/poop.json": "58c4fd50b13cda7430e476a61c849142",
"assets/assets/animations/donkey.svg": "9c21c2d85adc5410bebf5b7147597fe9",
"assets/assets/animations/stickers/cool.json": "6ed39d20644a82d78edb66cc1ad4b5d2",
"assets/assets/animations/stickers/laughing_tears.json": "24949039defece3a4711fa50ef5c7f84",
"assets/assets/animations/stickers/angry.json": "71615606e368fcf8add5db061fc71272",
"assets/assets/animations/stickers/heart_eyes.json": "f59dac818ac5aa23c5450a82576950bc",
"assets/assets/animations/stickers/grieved.json": "1b91d69c9efe83b92016c2191d4cb0b4",
"assets/assets/animations/stickers/blushing.json": "ff0c5357f3bd5617919af7ab398a3518",
"assets/assets/animations/stickers/flushed.json": "3105d7c90f9cc67fc809a38956c8e0d2",
"assets/assets/animations/stickers/kiss.json": "54fec12478a2ee6424895c4ae6b46b56",
"assets/assets/animations/stickers/calm.json": "075d2d8400a11e9334bbcc897874fcc7",
"assets/assets/animations/stickers/silly.json": "0f95ebe63cf93de6ee2bfd9c1ebf0708",
"assets/assets/animations/stickers/sleeping.json": "6a26588fedd1e51b441b2abaafd66805",
"assets/assets/animations/stickers/crying.json": "6780f07ff8711612a740492edf252bd1",
"assets/assets/animations/stickers/nose_steam.json": "c833213a17429da8ffd02df42306eb8a",
"assets/assets/animations/stickers/cussing.json": "b1f14d9e62e8259d242f59e69aac62be",
"assets/assets/animations/stickers/vomiting.json": "3aea41ee27ef9665e8aa5e30d0b6c39b",
"assets/assets/animations/stickers/angel.json": "7a0021f92f0864de9dea0e9197b665b9",
"assets/assets/animations/stickers/shocked.json": "d61549d332431804640034d66c3676b3",
"assets/assets/animations/stickers/laughing.json": "3829d1ed01b8aebbdfa8b7f8529049c2",
"assets/assets/animations/stickers/sad_tear.json": "962ee48d7e65c50be4e2490c988cca0d",
"assets/assets/animations/gorilla.svg": "1272124635d9d63c3e9eb13f5ae92f95",
"assets/assets/animations/fish.mp3": "547274a8bcca2fb22d126d8a3ea5f185",
"assets/assets/animations/chicken.svg": "ad315a61d4593bc96ad5465dc3b9d815",
"assets/assets/animations/donkey.json": "a2707a5c093ccf873b2cf18479f8e475",
"assets/assets/animations/rat.svg": "2db71a6b9af3b4978bad2a190bf91ca9",
"assets/assets/animations/chicken.json": "ad01d598689ea6e98f656fe689141796",
"assets/assets/animations/poop.gif": "0ee24f46ec631ec89c59e2c1fb41dcd7",
"assets/assets/animations/ORIGINAL-fireworks2.gif": "2e900840efe2db5d3686332b76cc0837",
"assets/assets/animations/fish.json": "75c7adfac49265c2268e5606cd75e950",
"assets/assets/animations/fireworks.json": "4fe787dcab454ff3dcb09d485ab40af0",
"assets/assets/animations/poop.mp3": "72a5440208a7dfeb5ea4eb8e9bc0e857",
"assets/assets/animations/fish.svg": "41dea042f417097a7535ee56e50f45e2",
"assets/assets/animations/bombpot.json": "e76573bd2fe57f462f79e8c72f3c8862",
"assets/assets/animations/chicken.mp3": "3641fc765db701efbe3b07479be79eb0",
"assets/assets/animations/fireworks2-SINGLE-LOOP.gif": "01f0502aeb072767a054d32538522f45",
"assets/assets/animations/fireworks.gif": "321bfcff4ed9e9c67ba1ef6cebf62c93",
"assets/assets/animations/rat.mp3": "3332e11a0ad6cfb01769959358afff45",
"assets/assets/animations/cheers.png": "9e6b7cbeb8ac4b16342000f7fd87ce60",
"assets/assets/animations/fireworks2.json": "6519d1e9d9c601d7e93174aac3e25dc5",
"assets/assets/animations/donkey.mp3": "fecf70afb94344b0ed8f97ad0b6980fd",
"assets/assets/animations/gorilla.mp3": "46d8c6906fdf54be5120b741daa19d62",
"assets/assets/animations/clean_svgs.sh": "835553cfbc536326267df8ef2474b1c2",
"assets/assets/animations/rat.json": "535ec381a1efa5455ae30137ea632dd0",
"assets/assets/animations/poop.svg": "153bdaeb1a1b465f88d1842e2bf0a951",
"assets/assets/animations/fireworks.mp3": "8a6d1d2b6480dc3e1b0d96f53bfdfff6",
"assets/assets/animations/cheers.json": "80ec910148f5f846b6189ad067f1efbd",
"assets/assets/animations/cheers.svg": "2fa54a129cf401a1cb996fb50f01d69b",
"assets/assets/animations/gorilla.json": "1b1cb87d617c639fbfbc0f54e8875b33",
"assets/assets/animations/fireworks2.gif": "2357989d2fb3c3e0c73b15d6dbae2e2a",
"assets/assets/animations/winner.json": "e92d052139ff3021e103638e22271464",
"assets/assets/sample-data/handlog/holdem/runittwice.json": "097b2483d87466d1c6d31d6cfc0a103d",
"assets/assets/sample-data/handlog/holdem/onewinner.json": "672fa8c96c788741af6a72d4530a9df6",
"assets/assets/sample-data/handlog/holdem/threepots.json": "117c8e39b9274f7ae410417ad4cb306a",
"assets/assets/sample-data/handlog/holdem/preflop.json": "a0adaabeb577de20c0ef2a386ed40d8b",
"assets/assets/sample-data/handlog/holdem/twowinners.json": "8c602b427a4fbcc9f5ad448fdc03f61c",
"assets/assets/sample-data/handlog/holdem/turn.json": "ce280aa1b98557c1acbbd6d52fbc2d8e",
"assets/assets/sample-data/handlog/holdem/river.json": "05cbae7ea4706a43634a68c4c82d97d7",
"assets/assets/sample-data/handlog/holdem/flop.json": "1198a72ad6f8c19b80a557826d2ecf93",
"assets/assets/sample-data/handlog/5card-plo/onewinner.json": "80c10e47067c9c6583116730b79380cb",
"assets/assets/sample-data/handlog/plo/onewinner.json": "74ca14d36cffc3a357a5bbb57096b065",
"assets/assets/sample-data/handlog/plo/twowinners.json": "afedb62551f133eb2c3cec518a46f2e9",
"assets/assets/sample-data/handlog/plo-hilo/two-hi-two-lo-winners.json": "39b91f38d89d9621c4ec6d2327c1ce7c",
"assets/assets/sample-data/handlog/plo-hilo/one-hi-lo-winner.json": "3d6a374917bc62ad51ceaec7bb04da30",
"assets/assets/sample-data/handlog/plo-hilo/one-hi-two-lo-winners.json": "5cf1d5506d4b34390a58c425e88ce337",
"assets/assets/sample-data/handlog.json": "c1443687ec86a4f31df1055c63e0e174",
"assets/assets/sample-data/gameinfo.json": "44e03278c12eb5b70ddf62b409cc8547",
"assets/assets/sample-data/result.json": "9e8b0db75886057bdbc6d071929e5759",
"assets/assets/sample-data/bug.json": "216260b63e64ba811f934e95c146c7dc",
"assets/assets/sample-data/run-it-twice-new.json": "78f1a7df0382b674e939cfdd56cfce8c",
"assets/assets/sample-data/weekly-data.json": "004102436a563b37e43f33c6f32ebe09",
"assets/assets/sample-data/completed-game.json": "2e6b5934b048791ea6ed50b9b8f9dca3",
"assets/assets/sample-data/handmessages.txt": "1b48e6b50808b366f14f3eea8a4a2543",
"assets/assets/sample-data/handlog-holdem.json": "a9376f744f8081f58d51655b29945d47",
"assets/assets/sample-data/completed-game2.json": "189ff8a10aca18071dbd1ac653766584",
"assets/assets/sample-data/result-new-2.json": "b542a10df74f2aef4ebb540a629b1a87",
"assets/assets/sample-data/performance.json": "ab46f2f681911a2de64f7ca3e125a34a",
"assets/assets/sample-data/stats_new.json": "cd6e58ac088b6267c3fb86ceccb22277",
"assets/assets/sample-data/handlog-plo.json": "8dff853aef0df8f86a77b8312d44d5be",
"assets/assets/sample-data/run-it-twice-result.json": "64ee1ec0cf54333f7728443c0c088c98",
"assets/assets/sample-data/multiple-winners.json": "1497cd90d4abeabd3b146db179790fbd",
"assets/assets/sample-data/players.json": "a09f9c478ce583ec4d9870c5e61a60f8",
"assets/assets/sample-data/member-details.json": "6f43f5316a78baa684c7edb4e2751bb2",
"assets/assets/sample-data/handlog2.json": "b52e30260b91bc26e6665b3939415d96",
"assets/assets/sample-data/stats.json": "f444a3446d3d9b2430ffa6fbd52fce04",
"assets/assets/sample-data/result-new.json": "f698d09dec9f959ac77c9d3a59a86b64",
"assets/assets/sample-data/club-stats.json": "ea7558a3e9dea707409cda4fd2669ccd",
"assets/assets/sample-data/handlog3.json": "c3af61ec3e31cbd855821ff64dd9705f",
"assets/assets/sample-data/run-it-twice-prompt.json": "0e822ba8d7f26be9abe4fe0b5b790ddf",
"assets/assets/sample-data/run-it-twice-new2.json": "b542a10df74f2aef4ebb540a629b1a87",
"assets/assets/sample-data/livegames.json": "0d2141926b4aef3d819cce87c11b9d97",
"canvaskit/canvaskit.js": "c2b4e5f3d7a3d82aed024e7249a78487",
"canvaskit/profiling/canvaskit.js": "ae2949af4efc61d28a4a80fffa1db900",
"canvaskit/profiling/canvaskit.wasm": "95e736ab31147d1b2c7b25f11d4c32cd",
"canvaskit/canvaskit.wasm": "4b83d89d9fecbea8ca46f2f760c5a9ba"
};

// The application shell files that are downloaded before a service worker can
// start.
const CORE = [
  "main.dart.js",
"index.html",
"assets/NOTICES",
"assets/AssetManifest.json",
"assets/FontManifest.json"];
// During install, the TEMP cache is populated with the application shell files.
self.addEventListener("install", (event) => {
  self.skipWaiting();
  return event.waitUntil(
    caches.open(TEMP).then((cache) => {
      return cache.addAll(
        CORE.map((value) => new Request(value, {'cache': 'reload'})));
    })
  );
});

// During activate, the cache is populated with the temp files downloaded in
// install. If this service worker is upgrading from one with a saved
// MANIFEST, then use this to retain unchanged resource files.
self.addEventListener("activate", function(event) {
  return event.waitUntil(async function() {
    try {
      var contentCache = await caches.open(CACHE_NAME);
      var tempCache = await caches.open(TEMP);
      var manifestCache = await caches.open(MANIFEST);
      var manifest = await manifestCache.match('manifest');
      // When there is no prior manifest, clear the entire cache.
      if (!manifest) {
        await caches.delete(CACHE_NAME);
        contentCache = await caches.open(CACHE_NAME);
        for (var request of await tempCache.keys()) {
          var response = await tempCache.match(request);
          await contentCache.put(request, response);
        }
        await caches.delete(TEMP);
        // Save the manifest to make future upgrades efficient.
        await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
        return;
      }
      var oldManifest = await manifest.json();
      var origin = self.location.origin;
      for (var request of await contentCache.keys()) {
        var key = request.url.substring(origin.length + 1);
        if (key == "") {
          key = "/";
        }
        // If a resource from the old manifest is not in the new cache, or if
        // the MD5 sum has changed, delete it. Otherwise the resource is left
        // in the cache and can be reused by the new service worker.
        if (!RESOURCES[key] || RESOURCES[key] != oldManifest[key]) {
          await contentCache.delete(request);
        }
      }
      // Populate the cache with the app shell TEMP files, potentially overwriting
      // cache files preserved above.
      for (var request of await tempCache.keys()) {
        var response = await tempCache.match(request);
        await contentCache.put(request, response);
      }
      await caches.delete(TEMP);
      // Save the manifest to make future upgrades efficient.
      await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
      return;
    } catch (err) {
      // On an unhandled exception the state of the cache cannot be guaranteed.
      console.error('Failed to upgrade service worker: ' + err);
      await caches.delete(CACHE_NAME);
      await caches.delete(TEMP);
      await caches.delete(MANIFEST);
    }
  }());
});

// The fetch handler redirects requests for RESOURCE files to the service
// worker cache.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  var origin = self.location.origin;
  var key = event.request.url.substring(origin.length + 1);
  // Redirect URLs to the index.html
  if (key.indexOf('?v=') != -1) {
    key = key.split('?v=')[0];
  }
  if (event.request.url == origin || event.request.url.startsWith(origin + '/#') || key == '') {
    key = '/';
  }
  // If the URL is not the RESOURCE list then return to signal that the
  // browser should take over.
  if (!RESOURCES[key]) {
    return;
  }
  // If the URL is the index.html, perform an online-first request.
  if (key == '/') {
    return onlineFirst(event);
  }
  event.respondWith(caches.open(CACHE_NAME)
    .then((cache) =>  {
      return cache.match(event.request).then((response) => {
        // Either respond with the cached resource, or perform a fetch and
        // lazily populate the cache.
        return response || fetch(event.request).then((response) => {
          cache.put(event.request, response.clone());
          return response;
        });
      })
    })
  );
});

self.addEventListener('message', (event) => {
  // SkipWaiting can be used to immediately activate a waiting service worker.
  // This will also require a page refresh triggered by the main worker.
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
    return;
  }
  if (event.data === 'downloadOffline') {
    downloadOffline();
    return;
  }
});

// Download offline will check the RESOURCES for all files not in the cache
// and populate them.
async function downloadOffline() {
  var resources = [];
  var contentCache = await caches.open(CACHE_NAME);
  var currentContent = {};
  for (var request of await contentCache.keys()) {
    var key = request.url.substring(origin.length + 1);
    if (key == "") {
      key = "/";
    }
    currentContent[key] = true;
  }
  for (var resourceKey of Object.keys(RESOURCES)) {
    if (!currentContent[resourceKey]) {
      resources.push(resourceKey);
    }
  }
  return contentCache.addAll(resources);
}

// Attempt to download the resource online before falling back to
// the offline cache.
function onlineFirst(event) {
  return event.respondWith(
    fetch(event.request).then((response) => {
      return caches.open(CACHE_NAME).then((cache) => {
        cache.put(event.request, response.clone());
        return response;
      });
    }).catch((error) => {
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response != null) {
            return response;
          }
          throw error;
        });
      });
    })
  );
}
