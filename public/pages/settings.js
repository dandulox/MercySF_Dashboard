import { t, getLanguage } from '/lib/i18n.js';

const GROUP_ORDER = ['quest', 'arena', 'dungeon', 'fortress', 'underworld', 'pets', 'guild', 'world_boss', 'timing', 'notifications', 'sonstiges'];

const GROUP_LABELS_DE = {
  quest: 'Quests & Taverne',
  arena: 'Arena & Sammelalbum',
  dungeon: 'Dungeons & Verliese',
  fortress: 'Festung',
  underworld: 'Unterwelt',
  pets: 'Haustiere',
  guild: 'Gilde',
  world_boss: 'Weltboss',
  timing: 'Timing & Verhalten',
  notifications: 'Benachrichtigungen',
  sonstiges: 'Sonstiges',
};

const GROUP_LABELS_EN = {
  quest: 'Quests & Tavern',
  arena: 'Arena & Scrapbook',
  dungeon: 'Dungeons',
  fortress: 'Fortress',
  underworld: 'Underworld',
  pets: 'Pets',
  guild: 'Guild',
  world_boss: 'World Boss',
  timing: 'Timing & Behavior',
  notifications: 'Notifications',
  sonstiges: 'Other',
};

function groupLabels() {
  return getLanguage() === 'en' ? GROUP_LABELS_EN : GROUP_LABELS_DE;
}

function groupKey(key) {
  const groups = [
    ['notifications', /^notify_/],
    ['timing', /^(poll_interval_secs|humanize_|active_hours_|active_windows|diagnostic_logging|module_priorities)/],
    ['world_boss', /^world_boss_/],
    ['guild', /^(auto_guild|guild_|start_guild)/],
    ['underworld', /^(auto_underworld|underworld_)/],
    ['fortress', /^(auto_fortress|fortress_)/],
    ['pets', /^(auto_pets|pet_|juice_)/],
    ['dungeon', /^(auto_dungeon|dungeon_|use_mushrooms_dungeon|auto_legendary_dungeon|use_mushrooms_legendary|use_mushrooms_tower|auto_tower|auto_hellevator|use_mushrooms_hellevator)/],
    ['arena', /^(auto_arena|min_fight_win_chance|use_mushrooms_arena|arena_target)/],
    ['quest', /^(auto_quest|auto_expedition|auto_cityguard|cityguard_hours|tavern_|beer_|use_task_bonus_beer|auto_do_tasks|task_use_mushrooms|collect_advent_calendar|auto_lucky_turn|max_lucky_turns|quest_priority|quest_smart_primary|no_town_watch|use_mushrooms_expedition|auto_dice_game|auto_calendar)/],
  ];
  for (const [name, re] of groups) if (re.test(key)) return name;
  return 'sonstiges';
}

// Menschenlesbare Bezeichnungen + kurze Erklärungen für die bekannten Bot-Einstellungen.
// Alles, was hier nicht aufgeführt ist, bekommt automatisch einen aus dem Schlüsselnamen
// abgeleiteten Titel (siehe humanizeKey) — nichts wird also unbeschriftet gelassen.
const LABELS_DE = {
  config_version: { label: 'Config-Version', desc: 'Interne Versionsnummer der Einstellungsdatei — nicht manuell ändern.' },

  // Quests & Taverne
  auto_quest: { label: 'Quests automatisieren', desc: 'Startet automatisch Quests und sammelt Belohnungen.' },
  auto_expedition: { label: 'Expeditionen automatisieren', desc: 'Startet verfügbare Expeditionen automatisch.' },
  auto_cityguard: { label: 'Stadtwache automatisieren', desc: 'Schickt den Charakter automatisch zur Stadtwache.' },
  cityguard_hours: { label: 'Stadtwache-Dauer (Stunden)', desc: 'Wie viele Stunden die Stadtwache jeweils dauern soll.' },
  auto_do_tasks: { label: 'Gilden-Aufgaben erledigen', desc: 'Erledigt automatisch anstehende Gilden-Aufgaben.' },
  task_use_mushrooms: { label: 'Pilze für Aufgaben nutzen', desc: 'Erlaubt den Einsatz von Pilzen, um Gilden-Aufgaben zu beschleunigen.' },
  use_task_bonus_beer: { label: 'Bonus-Bier für Aufgaben nutzen', desc: 'Nutzt Bonus-Bier aus Aufgaben-Belohnungen für weitere Quests.' },
  beer_ignores_mushroom_reserve: { label: 'Bier ignoriert Pilz-Reserve', desc: 'Kauft Bier auch, wenn das die Mindest-Pilzreserve unterschreiten würde.' },
  beer_auto_detect_free: { label: 'Kostenlose Bier-Slots erkennen', desc: 'Nutzt automatisch verfügbare kostenlose Biere, bevor gekauft wird.' },
  beer_buy_amount: { label: 'Bier-Kaufmenge', desc: 'Wie viele Biere pro Kauf-Vorgang automatisch gekauft werden.' },
  beer_event_amount: { label: 'Bier-Kaufmenge (Event)', desc: 'Kaufmenge für Bier während laufender Server-Events.' },
  collect_advent_calendar: { label: 'Kalender/Adventskalender abholen', desc: 'Holt tägliche Kalender-Belohnungen automatisch ab.' },
  auto_lucky_turn: { label: 'Glücksrad automatisch drehen', desc: 'Dreht das Glücksrad automatisch, wenn verfügbar.' },
  auto_lucky_turn_for_mush: { label: 'Glücksrad auch für Pilze drehen', desc: 'Dreht das Glücksrad auch dann, wenn dabei Pilze eingesetzt werden müssten.' },
  max_lucky_turns_per_day: { label: 'Max. Glücksrad-Drehungen/Tag', desc: 'Obergrenze für automatische Glücksrad-Drehungen an normalen Tagen.' },
  max_lucky_turns_per_day_event: { label: 'Max. Glücksrad-Drehungen/Tag (Event)', desc: 'Obergrenze für Glücksrad-Drehungen an Event-Tagen.' },
  quest_priority: { label: 'Quest-Priorität', desc: 'Strategie zur Auswahl der nächsten Quest (z. B. schnellste oder lohnendste zuerst).' },
  quest_smart_primary: { label: 'Smart-Priorität: Hauptkriterium', desc: 'Bei "Smart"-Priorität das wichtigste Auswahlkriterium (z. B. XP).' },
  no_town_watch_before_arena_wins: { label: 'Keine Stadtwache vor Arena-Siegen', desc: 'Verzögert die Stadtwache, bis genug Arena-Siege erzielt wurden.' },
  auto_dice_game: { label: 'Würfelspiel automatisieren', desc: 'Spielt das Taverne-Würfelspiel automatisch mit.' },
  auto_calendar: { label: 'Kalender automatisieren', desc: 'Verwaltet den Event-Kalender automatisch.' },
  auto_unlock_features: { label: 'Neue Funktionen freischalten', desc: 'Schaltet neu verfügbare Spielfunktionen automatisch frei.' },
  auto_claim_rewards: { label: 'Belohnungen automatisch abholen', desc: 'Holt verfügbare Belohnungen (Post, Erfolge etc.) automatisch ab.' },
  auto_idle_game: { label: 'Leerlauf-Spiel automatisieren', desc: 'Verwaltet das Idle-Minigame automatisch.' },
  tavern_prefer_expedition: { label: 'Expeditionen bevorzugen', desc: 'Bevorzugt Expeditionen gegenüber normalen Quests, wenn beides verfügbar ist.' },
  tavern_quest_start: { label: 'Quest-Start-Verzögerung', desc: 'Wartezeit, bevor eine neue Quest automatisch gestartet wird.' },

  // Arena & Sammelalbum
  auto_arena: { label: 'Arena automatisieren', desc: 'Kämpft automatisch gegen Arena-Gegner.' },
  min_fight_win_chance: { label: 'Mindest-Gewinnchance (%)', desc: 'Ein Kampf wird nur automatisch geführt, wenn die geschätzte Gewinnchance darüber liegt.' },
  use_mushrooms_arena: { label: 'Pilze in der Arena nutzen', desc: 'Erlaubt Pilzeinsatz, um zusätzliche Arena-Kämpfe zu ermöglichen.' },
  auto_arena_stop_on_cityguard: { label: 'Arena bei Stadtwache stoppen', desc: 'Pausiert Arena-Kämpfe, solange die Stadtwache aktiv ist.' },
  auto_arena_xp_first: { label: 'XP-Gegner zuerst angreifen', desc: 'Bevorzugt Gegner mit höherem XP-Ertrag bei der Zielauswahl.' },
  auto_arena_simulate: { label: 'Kämpfe vorab simulieren', desc: 'Simuliert Arena-Kämpfe vor der Ausführung, um die Gewinnchance zu prüfen.' },
  arena_target: { label: 'Ziel-Strategie', desc: 'Wie Arena-Gegner ausgewählt werden (z. B. beste Gewinnchance).' },

  // Dungeons & Verliese
  auto_dungeon: { label: 'Dungeons automatisieren', desc: 'Durchläuft verfügbare Dungeons automatisch.' },
  auto_tower: { label: 'Turm automatisieren', desc: 'Durchläuft den Turm-Dungeon automatisch.' },
  auto_hellevator: { label: 'Hellevator automatisieren', desc: 'Nimmt automatisch am Hellevator-Event teil.' },
  use_mushrooms_hellevator: { label: 'Pilze im Hellevator nutzen', desc: 'Erlaubt Pilzeinsatz für zusätzliche Hellevator-Versuche.' },
  auto_legendary_dungeon: { label: 'Legendäre Dungeons automatisieren', desc: 'Durchläuft legendäre Dungeons automatisch, sobald freigeschaltet.' },
  use_mushrooms_legendary: { label: 'Pilze in legendären Dungeons nutzen', desc: 'Erlaubt Pilzeinsatz für zusätzliche Versuche in legendären Dungeons.' },
  use_mushrooms_dungeon: { label: 'Pilze in Dungeons nutzen', desc: 'Erlaubt Pilzeinsatz für zusätzliche Dungeon-Versuche.' },
  use_mushrooms_tower: { label: 'Pilze im Turm nutzen', desc: 'Erlaubt Pilzeinsatz für zusätzliche Turm-Versuche.' },
  dungeon_save_fight_report: { label: 'Kampfberichte speichern', desc: 'Speichert Dungeon-Kampfberichte für die Kampfhistorie.' },
  auto_dungeon_companion_equip: { label: 'Begleiter automatisch ausrüsten', desc: 'Rüstet Dungeon-Begleiter automatisch mit verfügbarer Ausrüstung aus.' },
  auto_dungeon_portal: { label: 'Dungeon-Portal automatisieren', desc: 'Nutzt das Dungeon-Portal automatisch, sobald verfügbar.' },

  // Festung
  auto_fortress: { label: 'Festung automatisieren', desc: 'Verwaltet die Festung automatisch (Ressourcen, Gebäude, Truppen).' },
  auto_fortress_gather_wood: { label: 'Holz sammeln', desc: 'Sammelt automatisch Holz für die Festung.' },
  auto_fortress_gather_stone: { label: 'Stein sammeln', desc: 'Sammelt automatisch Stein für die Festung.' },
  auto_fortress_gather_exp: { label: 'Erfahrung sammeln (Festung)', desc: 'Sammelt automatisch Festungs-Erfahrungspunkte.' },
  auto_fortress_upgrade_buildings: { label: 'Gebäude ausbauen', desc: 'Baut Festungsgebäude automatisch aus, sobald genug Ressourcen vorhanden sind.' },
  auto_fortress_search_gems: { label: 'Edelsteine suchen', desc: 'Startet automatisch die Edelstein-Suche in der Festung.' },
  fortress_search_gems_skip: { label: 'Edelstein-Suche überspringen', desc: 'Überspringt die Edelstein-Suche unter bestimmten Bedingungen.' },
  fortress_search_gems_skip_time: { label: 'Edelstein-Suche: Zeit zum Überspringen', desc: 'Zeitpunkt/Dauer, ab der die Edelstein-Suche übersprungen wird.' },
  auto_fortress_upgrade_soldier: { label: 'Soldaten aufwerten', desc: 'Wertet Soldaten-Einheiten automatisch auf.' },
  auto_fortress_upgrade_archer: { label: 'Bogenschützen aufwerten', desc: 'Wertet Bogenschützen-Einheiten automatisch auf.' },
  auto_fortress_upgrade_mage: { label: 'Magier aufwerten', desc: 'Wertet Magier-Einheiten automatisch auf.' },
  auto_fortress_build_soldier: { label: 'Soldaten ausbilden', desc: 'Bildet automatisch neue Soldaten-Einheiten aus.' },
  auto_fortress_build_archer: { label: 'Bogenschützen ausbilden', desc: 'Bildet automatisch neue Bogenschützen-Einheiten aus.' },
  auto_fortress_build_mage: { label: 'Magier ausbilden', desc: 'Bildet automatisch neue Magier-Einheiten aus.' },
  fortress_attack_loose_1_soldier_min: { label: 'Min. Soldaten bei knappem Angriff', desc: 'Mindestanzahl Soldaten, die bei einem riskanten Angriff eingesetzt werden.' },
  fortress_attack_min_start_soldiers_pct: { label: 'Min. Truppenstärke für Angriff (%)', desc: 'Ein Festungsangriff startet nur, wenn mindestens dieser Anteil der Truppen verfügbar ist.' },
  fortress_attack_partner: { label: 'Angriffspartner', desc: 'Bevorzugter Partner-Account für gemeinsame Festungsangriffe.' },
  fortress_protect_chars: { label: 'Geschützte Charaktere', desc: 'Charaktere, die bei Festungsangriffen nicht als Ziel ausgewählt werden.' },
  fortress_partner_max_rerolls: { label: 'Max. Partner-Rerolls', desc: 'Wie oft ein neuer Angriffspartner ausgewürfelt werden darf.' },
  fortress_partner_use_mushroom_reroll: { label: 'Pilze für Partner-Reroll nutzen', desc: 'Erlaubt Pilzeinsatz, um einen neuen Angriffspartner zu erhalten.' },

  // Unterwelt
  auto_underworld: { label: 'Unterwelt automatisieren', desc: 'Verwaltet die Unterwelt automatisch (Ressourcen, Gebäude, Kämpfe).' },
  auto_underworld_gather_souls: { label: 'Seelen sammeln', desc: 'Sammelt automatisch Seelen in der Unterwelt.' },
  auto_underworld_gather_silver: { label: 'Silber sammeln (Unterwelt)', desc: 'Sammelt automatisch Silber in der Unterwelt.' },
  auto_underworld_gather_tfa: { label: 'Ur-Artefakte sammeln', desc: 'Sammelt automatisch Ur-Artefakte in der Unterwelt.' },
  auto_underworld_upgrade_keeper: { label: 'Wächter aufwerten', desc: 'Wertet den Unterwelt-Wächter automatisch auf.' },
  auto_underworld_upgrade_troll: { label: 'Troll aufwerten', desc: 'Wertet die Troll-Einheit automatisch auf.' },
  auto_underworld_upgrade_goblin: { label: 'Goblin aufwerten', desc: 'Wertet die Goblin-Einheit automatisch auf.' },
  auto_underworld_enable_fights: { label: 'Unterwelt-Kämpfe erlauben', desc: 'Erlaubt automatische Angriffe auf andere Unterwelten.' },
  underworld_attack_mode: { label: 'Angriffsmodus', desc: 'Strategie zur Auswahl von Unterwelt-Angriffszielen.' },
  underworld_attack_favorite_chars: { label: 'Bevorzugte Angriffsziele', desc: 'Liste bevorzugter Charaktere für Unterwelt-Angriffe.' },
  underworld_upgrade_units_keep_souls: { label: 'Seelen-Reserve für Upgrades', desc: 'Mindestmenge an Seelen, die nicht für Upgrades ausgegeben wird.' },
  underworld_gather_stop_from_hour: { label: 'Sammeln pausieren ab (Stunde)', desc: 'Uhrzeit, ab der das automatische Sammeln pausiert wird.' },
  underworld_gather_stop_until_hour: { label: 'Sammeln pausiert bis (Stunde)', desc: 'Uhrzeit, bis zu der das automatische Sammeln pausiert bleibt.' },

  // Haustiere
  auto_pets: { label: 'Haustiere automatisieren', desc: 'Verwaltet Haustiere automatisch (Fütterung, Kämpfe, Dungeons).' },
  auto_pets_feed: { label: 'Haustiere füttern', desc: 'Füttert Haustiere automatisch mit verfügbarem Saft.' },
  auto_pets_dungeons: { label: 'Haustier-Dungeons automatisieren', desc: 'Erkundet Haustier-Dungeons automatisch.' },
  auto_pets_arena: { label: 'Haustier-Arena automatisieren', desc: 'Bestreitet Haustier-Arenakämpfe automatisch.' },
  pet_juice_priority: { label: 'Saft-Priorität', desc: 'Welche Saft-Sorte bei der Herstellung bevorzugt wird.' },
  juice_enable: { label: 'Saftherstellung aktivieren', desc: 'Stellt automatisch Saft für Haustiere her.' },
  juice_min_shadow: { label: 'Mindestbestand Schatten-Saft', desc: 'Menge, die als Reserve nicht verbraucht wird.' },
  juice_min_light: { label: 'Mindestbestand Licht-Saft', desc: 'Menge, die als Reserve nicht verbraucht wird.' },
  juice_min_earth: { label: 'Mindestbestand Erd-Saft', desc: 'Menge, die als Reserve nicht verbraucht wird.' },
  juice_min_fire: { label: 'Mindestbestand Feuer-Saft', desc: 'Menge, die als Reserve nicht verbraucht wird.' },
  juice_min_water: { label: 'Mindestbestand Wasser-Saft', desc: 'Menge, die als Reserve nicht verbraucht wird.' },

  // Gilde
  auto_guild: { label: 'Gilde automatisieren', desc: 'Verwaltet Gilden-Aktivitäten automatisch.' },
  auto_guild_portal: { label: 'Gildenportal automatisieren', desc: 'Kämpft automatisch im Gildenportal.' },
  guild_portal_after_quests: { label: 'Gildenportal erst nach Quests', desc: 'Startet das Gildenportal erst, wenn alle Quests erledigt sind.' },
  auto_guild_hydra: { label: 'Hydra automatisieren', desc: 'Bekämpft die Gilden-Hydra automatisch.' },
  guild_hydra_rush_before_midnight: { label: 'Hydra vor Mitternacht forcieren', desc: 'Setzt kurz vor Mitternacht verstärkt auf Hydra-Angriffe.' },
  guild_hydra_after_quests: { label: 'Hydra erst nach Quests', desc: 'Bekämpft die Hydra erst, wenn alle Quests erledigt sind.' },
  auto_guild_raid: { label: 'Gilden-Raid automatisieren', desc: 'Nimmt automatisch an Gilden-Raids teil.' },
  start_guild_raid: { label: 'Gilden-Raid manuell starten', desc: 'Startet einen Gilden-Raid zu einem festgelegten Zeitpunkt.' },
  start_guild_raid_datetime: { label: 'Gilden-Raid Startzeitpunkt', desc: 'Datum/Uhrzeit für den geplanten Gilden-Raid-Start.' },
  start_reoccurring_guild_raid_day: { label: 'Wiederkehrender Raid: Wochentag', desc: 'Wochentag für einen sich wiederholenden Gilden-Raid.' },
  start_reoccurring_guild_raid_time: { label: 'Wiederkehrender Raid: Uhrzeit', desc: 'Uhrzeit für einen sich wiederholenden Gilden-Raid.' },
  auto_guild_attack: { label: 'Gildenangriffe automatisieren', desc: 'Beteiligt sich automatisch an Gilden-gegen-Gilde-Angriffen.' },
  auto_guild_defense: { label: 'Gildenverteidigung automatisieren', desc: 'Beteiligt sich automatisch an der Gildenverteidigung.' },
  guild_fights_attack: { label: 'An Angriffskämpfen teilnehmen', desc: 'Nimmt an offensiven Gildenkämpfen teil.' },
  guild_fights_def: { label: 'An Verteidigungskämpfen teilnehmen', desc: 'Nimmt an defensiven Gildenkämpfen teil.' },
  guild_fights_raid: { label: 'An Raid-Kämpfen teilnehmen', desc: 'Nimmt an Gilden-Raid-Kämpfen teil.' },
  guild_min_wait_mins: { label: 'Min. Wartezeit (Minuten)', desc: 'Minimale Wartezeit zwischen Gildenkampf-Aktionen.' },
  guild_max_wait_mins: { label: 'Max. Wartezeit (Minuten)', desc: 'Maximale Wartezeit zwischen Gildenkampf-Aktionen.' },
  start_guild_fight_1: { label: 'Gildenkampf 1 zeitgesteuert starten', desc: 'Startet einen ersten geplanten Gildenkampf automatisch.' },
  start_guild_fight_2: { label: 'Gildenkampf 2 zeitgesteuert starten', desc: 'Startet einen zweiten geplanten Gildenkampf automatisch.' },
  start_guild_fights_time_1: { label: 'Startzeit Gildenkampf 1', desc: 'Geplante Uhrzeit für den ersten Gildenkampf.' },
  start_guild_fights_time_2: { label: 'Startzeit Gildenkampf 2', desc: 'Geplante Uhrzeit für den zweiten Gildenkampf.' },
  guild_fights_favorite_guilds: { label: 'Bevorzugte Ziel-Gilden', desc: 'Liste bevorzugter gegnerischer Gilden für Gildenkämpfe.' },
  guild_donate_long_cityguard_only: { label: 'Spenden nur bei langer Stadtwache', desc: 'Spendet nur an die Gilde, wenn die Stadtwache lange genug läuft.' },

  // Weltboss
  auto_world_boss: { label: 'Weltboss automatisieren', desc: 'Beteiligt sich automatisch am Weltboss-Event.' },
  world_boss_auto_upgrade: { label: 'Weltboss-Ausrüstung aufwerten', desc: 'Wertet Weltboss-Ausrüstung automatisch auf.' },
  world_boss_use_mushrooms: { label: 'Pilze für Weltboss nutzen', desc: 'Erlaubt Pilzeinsatz für zusätzliche Weltboss-Angriffe.' },
  world_boss_max_catalysts_spend: { label: 'Max. Katalysator-Verbrauch', desc: 'Obergrenze für den Verbrauch von Katalysatoren beim Weltboss.' },
  world_boss_max_upgrade_level: { label: 'Max. Aufwertungsstufe', desc: 'Höchste Stufe, bis zu der Weltboss-Ausrüstung automatisch aufgewertet wird.' },
  world_boss_reroll_upgrade_shop: { label: 'Aufwertungs-Shop neu würfeln', desc: 'Würfelt das Angebot im Weltboss-Aufwertungs-Shop bei Bedarf neu aus.' },
  world_boss_max_mushroom_spend: { label: 'Max. Pilz-Verbrauch (Weltboss)', desc: 'Obergrenze für den Pilzverbrauch beim Weltboss.' },

  // Ausrüstung / Skills / Verbrauch
  auto_equip_better: { label: 'Bessere Ausrüstung anlegen', desc: 'Rüstet automatisch bessere gefundene Gegenstände aus.' },
  auto_equip_gems: { label: 'Edelsteine automatisch einsetzen', desc: 'Setzt gefundene Edelsteine automatisch in Ausrüstung ein.' },
  auto_sell_items: { label: 'Gegenstände automatisch verkaufen', desc: 'Verkauft nicht benötigte Gegenstände automatisch.' },
  auto_buy_bottles: { label: 'Tränke-Fläschchen automatisch kaufen', desc: 'Kauft leere Fläschchen für Tränke automatisch nach.' },
  auto_buy_better_items: { label: 'Bessere Items im Shop kaufen', desc: 'Kauft automatisch bessere Ausrüstung aus dem Shop, wenn verfügbar.' },
  auto_buy_potions: { label: 'Tränke automatisch kaufen', desc: 'Kauft benötigte Tränke automatisch nach.' },
  auto_skills: { label: 'Attributspunkte automatisch verteilen', desc: 'Verteilt neue Attributspunkte automatisch.' },
  auto_enchant: { label: 'Verzauberungen automatisieren', desc: 'Verzaubert Ausrüstung automatisch, sobald möglich.' },
  auto_mount: { label: 'Reittiere automatisieren', desc: 'Verwaltet den Kauf/Einsatz von Reittieren automatisch.' },
  auto_mount_buy_lower: { label: 'Günstigere Reittiere kaufen', desc: 'Kauft bei Bedarf auch günstigere Reittier-Stufen.' },
  min_mush_mount: { label: 'Mindest-Pilzreserve für Reittiere', desc: 'Pilze, die für Reittier-Käufe nicht angetastet werden.' },
  auto_use_life_potions: { label: 'Lebenstränke automatisch nutzen', desc: 'Setzt Lebenstränke automatisch ein.' },
  auto_use_luck_potions: { label: 'Glückstränke automatisch nutzen', desc: 'Setzt Glückstränke automatisch ein.' },
  auto_use_main_potions: { label: 'Haupttränke automatisch nutzen', desc: 'Setzt Haupt-Attributstränke automatisch ein.' },
  auto_use_const_potions: { label: 'Konstitutionstränke automatisch nutzen', desc: 'Setzt Konstitutions-/Ausdauertränke automatisch ein.' },
  min_mushrooms: { label: 'Mindest-Pilzreserve', desc: 'Allgemeine Pilzreserve, die nicht automatisch verbraucht wird.' },
  min_lucky_coins: { label: 'Mindest-Glücksmünzen-Reserve', desc: 'Glücksmünzen, die als Reserve nicht automatisch verbraucht werden.' },
  use_mushrooms_mount: { label: 'Pilze für Reittiere nutzen', desc: 'Erlaubt Pilzeinsatz beim Reittierkauf.' },

  // Benachrichtigungen
  auto_notify: { label: 'Benachrichtigungen aktivieren', desc: 'Sendet Benachrichtigungen bei wichtigen Ereignissen.' },
  notify_discord_webhook: { label: 'Discord-Webhook-URL', desc: 'Ziel-Webhook für Discord-Benachrichtigungen.' },
  notify_telegram_token: { label: 'Telegram-Bot-Token', desc: 'Zugangstoken für Telegram-Benachrichtigungen.' },
  notify_telegram_chat: { label: 'Telegram-Chat-ID', desc: 'Ziel-Chat für Telegram-Benachrichtigungen.' },

  // Timing & Verhalten
  poll_interval_secs: { label: 'Abfrage-Intervall (Sekunden)', desc: 'Wie oft der Bot den Spielstatus abfragt.' },
  humanize_enabled: { label: 'Menschliches Verhalten simulieren', desc: 'Fügt zufällige Verzögerungen ein, um das Verhalten weniger bot-artig wirken zu lassen.' },
  humanize_action_delay_min_ms: { label: 'Min. Aktionsverzögerung (ms)', desc: 'Untere Grenze der zufälligen Verzögerung zwischen Aktionen.' },
  humanize_action_delay_max_ms: { label: 'Max. Aktionsverzögerung (ms)', desc: 'Obere Grenze der zufälligen Verzögerung zwischen Aktionen.' },
  humanize_poll_jitter_pct: { label: 'Abfrage-Schwankung (%)', desc: 'Zufällige prozentuale Schwankung des Abfrage-Intervalls.' },
  active_hours_enabled: { label: 'Aktive Zeiten einschränken', desc: 'Beschränkt den Bot-Betrieb auf bestimmte Tageszeiten.' },
  active_hours_start: { label: 'Aktiv ab (Stunde)', desc: 'Beginn des erlaubten Betriebszeitraums.' },
  active_hours_end: { label: 'Aktiv bis (Stunde)', desc: 'Ende des erlaubten Betriebszeitraums.' },
  active_windows: { label: 'Aktive Zeitfenster', desc: 'Detaillierte Liste erlaubter Betriebszeitfenster.' },
  diagnostic_logging: { label: 'Diagnose-Logging', desc: 'Schreibt zusätzliche Diagnoseinformationen ins Log.' },
  module_priorities: { label: 'Modul-Prioritäten', desc: 'Reihenfolge, in der Bot-Module bei Konflikten priorisiert werden.' },
};

const LABELS_EN = {
  config_version: { label: 'Config version', desc: 'Internal version number of the settings file — do not change manually.' },

  // Quests & Tavern
  auto_quest: { label: 'Automate quests', desc: 'Automatically starts quests and collects rewards.' },
  auto_expedition: { label: 'Automate expeditions', desc: 'Automatically starts available expeditions.' },
  auto_cityguard: { label: 'Automate city guard', desc: 'Automatically sends the character to city guard duty.' },
  cityguard_hours: { label: 'City guard duration (hours)', desc: 'How many hours each city guard shift should last.' },
  auto_do_tasks: { label: 'Complete guild tasks', desc: 'Automatically completes pending guild tasks.' },
  task_use_mushrooms: { label: 'Use mushrooms for tasks', desc: 'Allows spending mushrooms to speed up guild tasks.' },
  use_task_bonus_beer: { label: 'Use bonus beer for tasks', desc: 'Uses bonus beer from task rewards for further quests.' },
  beer_ignores_mushroom_reserve: { label: 'Beer ignores mushroom reserve', desc: 'Buys beer even if it would dip below the minimum mushroom reserve.' },
  beer_auto_detect_free: { label: 'Detect free beer slots', desc: 'Automatically uses available free beers before buying more.' },
  beer_buy_amount: { label: 'Beer purchase amount', desc: 'How many beers are automatically bought per purchase.' },
  beer_event_amount: { label: 'Beer purchase amount (event)', desc: 'Purchase amount for beer during active server events.' },
  collect_advent_calendar: { label: 'Collect calendar/advent calendar', desc: 'Automatically collects daily calendar rewards.' },
  auto_lucky_turn: { label: 'Spin the lucky wheel automatically', desc: 'Spins the lucky wheel automatically when available.' },
  auto_lucky_turn_for_mush: { label: 'Also spin lucky wheel for mushrooms', desc: 'Spins the lucky wheel even when it would cost mushrooms.' },
  max_lucky_turns_per_day: { label: 'Max. lucky wheel spins/day', desc: 'Cap on automatic lucky wheel spins on normal days.' },
  max_lucky_turns_per_day_event: { label: 'Max. lucky wheel spins/day (event)', desc: 'Cap on lucky wheel spins on event days.' },
  quest_priority: { label: 'Quest priority', desc: 'Strategy for choosing the next quest (e.g. fastest or most rewarding first).' },
  quest_smart_primary: { label: 'Smart priority: primary criterion', desc: 'With "smart" priority, the most important selection criterion (e.g. XP).' },
  no_town_watch_before_arena_wins: { label: 'No city guard before arena wins', desc: 'Delays city guard until enough arena wins have been achieved.' },
  auto_dice_game: { label: 'Automate dice game', desc: 'Automatically plays the tavern dice game.' },
  auto_calendar: { label: 'Automate calendar', desc: 'Manages the event calendar automatically.' },
  auto_unlock_features: { label: 'Unlock new features', desc: 'Automatically unlocks newly available game features.' },
  auto_claim_rewards: { label: 'Automatically claim rewards', desc: 'Automatically collects available rewards (mail, achievements, etc.).' },
  auto_idle_game: { label: 'Automate idle game', desc: 'Manages the idle minigame automatically.' },
  tavern_prefer_expedition: { label: 'Prefer expeditions', desc: 'Prefers expeditions over normal quests when both are available.' },
  tavern_quest_start: { label: 'Quest start delay', desc: 'Wait time before a new quest is started automatically.' },

  // Arena & Scrapbook
  auto_arena: { label: 'Automate arena', desc: 'Automatically fights arena opponents.' },
  min_fight_win_chance: { label: 'Minimum win chance (%)', desc: 'A fight is only fought automatically if the estimated win chance is above this.' },
  use_mushrooms_arena: { label: 'Use mushrooms in the arena', desc: 'Allows spending mushrooms to enable additional arena fights.' },
  auto_arena_stop_on_cityguard: { label: 'Pause arena during city guard', desc: 'Pauses arena fights while city guard is active.' },
  auto_arena_xp_first: { label: 'Attack XP opponents first', desc: 'Prefers opponents with higher XP yield when choosing a target.' },
  auto_arena_simulate: { label: 'Simulate fights beforehand', desc: 'Simulates arena fights before executing them to check the win chance.' },
  arena_target: { label: 'Target strategy', desc: 'How arena opponents are chosen (e.g. best win chance).' },

  // Dungeons
  auto_dungeon: { label: 'Automate dungeons', desc: 'Automatically runs available dungeons.' },
  auto_tower: { label: 'Automate tower', desc: 'Automatically runs the tower dungeon.' },
  auto_hellevator: { label: 'Automate hellevator', desc: 'Automatically participates in the hellevator event.' },
  use_mushrooms_hellevator: { label: 'Use mushrooms in the hellevator', desc: 'Allows spending mushrooms for extra hellevator attempts.' },
  auto_legendary_dungeon: { label: 'Automate legendary dungeons', desc: 'Automatically runs legendary dungeons once unlocked.' },
  use_mushrooms_legendary: { label: 'Use mushrooms in legendary dungeons', desc: 'Allows spending mushrooms for extra attempts in legendary dungeons.' },
  use_mushrooms_dungeon: { label: 'Use mushrooms in dungeons', desc: 'Allows spending mushrooms for extra dungeon attempts.' },
  use_mushrooms_tower: { label: 'Use mushrooms in the tower', desc: 'Allows spending mushrooms for extra tower attempts.' },
  dungeon_save_fight_report: { label: 'Save fight reports', desc: 'Saves dungeon fight reports to the fight history.' },
  auto_dungeon_companion_equip: { label: 'Auto-equip companion', desc: 'Automatically equips dungeon companions with available gear.' },
  auto_dungeon_portal: { label: 'Automate dungeon portal', desc: 'Automatically uses the dungeon portal once available.' },

  // Fortress
  auto_fortress: { label: 'Automate fortress', desc: 'Manages the fortress automatically (resources, buildings, troops).' },
  auto_fortress_gather_wood: { label: 'Gather wood', desc: 'Automatically gathers wood for the fortress.' },
  auto_fortress_gather_stone: { label: 'Gather stone', desc: 'Automatically gathers stone for the fortress.' },
  auto_fortress_gather_exp: { label: 'Gather experience (fortress)', desc: 'Automatically gathers fortress experience points.' },
  auto_fortress_upgrade_buildings: { label: 'Upgrade buildings', desc: 'Automatically upgrades fortress buildings once enough resources are available.' },
  auto_fortress_search_gems: { label: 'Search for gems', desc: 'Automatically starts the gem search in the fortress.' },
  fortress_search_gems_skip: { label: 'Skip gem search', desc: 'Skips the gem search under certain conditions.' },
  fortress_search_gems_skip_time: { label: 'Gem search: time to skip', desc: 'Time/duration after which the gem search is skipped.' },
  auto_fortress_upgrade_soldier: { label: 'Upgrade soldiers', desc: 'Automatically upgrades soldier units.' },
  auto_fortress_upgrade_archer: { label: 'Upgrade archers', desc: 'Automatically upgrades archer units.' },
  auto_fortress_upgrade_mage: { label: 'Upgrade mages', desc: 'Automatically upgrades mage units.' },
  auto_fortress_build_soldier: { label: 'Train soldiers', desc: 'Automatically trains new soldier units.' },
  auto_fortress_build_archer: { label: 'Train archers', desc: 'Automatically trains new archer units.' },
  auto_fortress_build_mage: { label: 'Train mages', desc: 'Automatically trains new mage units.' },
  fortress_attack_loose_1_soldier_min: { label: 'Min. soldiers for a risky attack', desc: 'Minimum number of soldiers used for a risky attack.' },
  fortress_attack_min_start_soldiers_pct: { label: 'Min. troop strength for attack (%)', desc: 'A fortress attack only starts if at least this share of troops is available.' },
  fortress_attack_partner: { label: 'Attack partner', desc: 'Preferred partner account for joint fortress attacks.' },
  fortress_protect_chars: { label: 'Protected characters', desc: 'Characters that are never chosen as targets in fortress attacks.' },
  fortress_partner_max_rerolls: { label: 'Max. partner rerolls', desc: 'How many times a new attack partner may be rerolled.' },
  fortress_partner_use_mushroom_reroll: { label: 'Use mushrooms for partner reroll', desc: 'Allows spending mushrooms to get a new attack partner.' },

  // Underworld
  auto_underworld: { label: 'Automate underworld', desc: 'Manages the underworld automatically (resources, buildings, fights).' },
  auto_underworld_gather_souls: { label: 'Gather souls', desc: 'Automatically gathers souls in the underworld.' },
  auto_underworld_gather_silver: { label: 'Gather silver (underworld)', desc: 'Automatically gathers silver in the underworld.' },
  auto_underworld_gather_tfa: { label: 'Gather ancient artifacts', desc: 'Automatically gathers ancient artifacts in the underworld.' },
  auto_underworld_upgrade_keeper: { label: 'Upgrade keeper', desc: 'Automatically upgrades the underworld keeper.' },
  auto_underworld_upgrade_troll: { label: 'Upgrade troll', desc: 'Automatically upgrades the troll unit.' },
  auto_underworld_upgrade_goblin: { label: 'Upgrade goblin', desc: 'Automatically upgrades the goblin unit.' },
  auto_underworld_enable_fights: { label: 'Allow underworld fights', desc: 'Allows automatic attacks on other underworlds.' },
  underworld_attack_mode: { label: 'Attack mode', desc: 'Strategy for choosing underworld attack targets.' },
  underworld_attack_favorite_chars: { label: 'Preferred attack targets', desc: 'List of preferred characters for underworld attacks.' },
  underworld_upgrade_units_keep_souls: { label: 'Soul reserve for upgrades', desc: 'Minimum amount of souls not spent on upgrades.' },
  underworld_gather_stop_from_hour: { label: 'Pause gathering from (hour)', desc: 'Time at which automatic gathering pauses.' },
  underworld_gather_stop_until_hour: { label: 'Gathering paused until (hour)', desc: 'Time until which automatic gathering stays paused.' },

  // Pets
  auto_pets: { label: 'Automate pets', desc: 'Manages pets automatically (feeding, fights, dungeons).' },
  auto_pets_feed: { label: 'Feed pets', desc: 'Automatically feeds pets with available juice.' },
  auto_pets_dungeons: { label: 'Automate pet dungeons', desc: 'Automatically explores pet dungeons.' },
  auto_pets_arena: { label: 'Automate pet arena', desc: 'Automatically fights pet arena battles.' },
  pet_juice_priority: { label: 'Juice priority', desc: 'Which juice type is preferred during production.' },
  juice_enable: { label: 'Enable juice production', desc: 'Automatically produces juice for pets.' },
  juice_min_shadow: { label: 'Minimum shadow juice reserve', desc: 'Amount kept in reserve and not consumed.' },
  juice_min_light: { label: 'Minimum light juice reserve', desc: 'Amount kept in reserve and not consumed.' },
  juice_min_earth: { label: 'Minimum earth juice reserve', desc: 'Amount kept in reserve and not consumed.' },
  juice_min_fire: { label: 'Minimum fire juice reserve', desc: 'Amount kept in reserve and not consumed.' },
  juice_min_water: { label: 'Minimum water juice reserve', desc: 'Amount kept in reserve and not consumed.' },

  // Guild
  auto_guild: { label: 'Automate guild', desc: 'Manages guild activities automatically.' },
  auto_guild_portal: { label: 'Automate guild portal', desc: 'Automatically fights in the guild portal.' },
  guild_portal_after_quests: { label: 'Guild portal only after quests', desc: 'Starts the guild portal only once all quests are done.' },
  auto_guild_hydra: { label: 'Automate hydra', desc: 'Automatically fights the guild hydra.' },
  guild_hydra_rush_before_midnight: { label: 'Rush hydra before midnight', desc: 'Pushes harder on hydra attacks shortly before midnight.' },
  guild_hydra_after_quests: { label: 'Hydra only after quests', desc: 'Fights the hydra only once all quests are done.' },
  auto_guild_raid: { label: 'Automate guild raid', desc: 'Automatically participates in guild raids.' },
  start_guild_raid: { label: 'Manually start guild raid', desc: 'Starts a guild raid at a scheduled time.' },
  start_guild_raid_datetime: { label: 'Guild raid start time', desc: 'Date/time for the scheduled guild raid start.' },
  start_reoccurring_guild_raid_day: { label: 'Recurring raid: weekday', desc: 'Weekday for a recurring guild raid.' },
  start_reoccurring_guild_raid_time: { label: 'Recurring raid: time', desc: 'Time for a recurring guild raid.' },
  auto_guild_attack: { label: 'Automate guild attacks', desc: 'Automatically participates in guild-vs-guild attacks.' },
  auto_guild_defense: { label: 'Automate guild defense', desc: 'Automatically participates in guild defense.' },
  guild_fights_attack: { label: 'Participate in attack fights', desc: 'Participates in offensive guild fights.' },
  guild_fights_def: { label: 'Participate in defense fights', desc: 'Participates in defensive guild fights.' },
  guild_fights_raid: { label: 'Participate in raid fights', desc: 'Participates in guild raid fights.' },
  guild_min_wait_mins: { label: 'Min. wait time (minutes)', desc: 'Minimum wait time between guild fight actions.' },
  guild_max_wait_mins: { label: 'Max. wait time (minutes)', desc: 'Maximum wait time between guild fight actions.' },
  start_guild_fight_1: { label: 'Start guild fight 1 on schedule', desc: 'Automatically starts a first scheduled guild fight.' },
  start_guild_fight_2: { label: 'Start guild fight 2 on schedule', desc: 'Automatically starts a second scheduled guild fight.' },
  start_guild_fights_time_1: { label: 'Guild fight 1 start time', desc: 'Scheduled time for the first guild fight.' },
  start_guild_fights_time_2: { label: 'Guild fight 2 start time', desc: 'Scheduled time for the second guild fight.' },
  guild_fights_favorite_guilds: { label: 'Preferred target guilds', desc: 'List of preferred rival guilds for guild fights.' },
  guild_donate_long_cityguard_only: { label: 'Donate only on long city guard', desc: 'Only donates to the guild when city guard runs long enough.' },

  // World Boss
  auto_world_boss: { label: 'Automate world boss', desc: 'Automatically participates in the world boss event.' },
  world_boss_auto_upgrade: { label: 'Upgrade world boss gear', desc: 'Automatically upgrades world boss equipment.' },
  world_boss_use_mushrooms: { label: 'Use mushrooms for world boss', desc: 'Allows spending mushrooms for extra world boss attacks.' },
  world_boss_max_catalysts_spend: { label: 'Max. catalyst spend', desc: 'Cap on catalyst consumption for the world boss.' },
  world_boss_max_upgrade_level: { label: 'Max. upgrade level', desc: 'Highest level world boss equipment is automatically upgraded to.' },
  world_boss_reroll_upgrade_shop: { label: 'Reroll upgrade shop', desc: 'Rerolls the offer in the world boss upgrade shop when needed.' },
  world_boss_max_mushroom_spend: { label: 'Max. mushroom spend (world boss)', desc: 'Cap on mushroom consumption for the world boss.' },

  // Equipment / Skills / Consumables
  auto_equip_better: { label: 'Equip better gear', desc: 'Automatically equips better items that are found.' },
  auto_equip_gems: { label: 'Auto-socket gems', desc: 'Automatically sockets found gems into equipment.' },
  auto_sell_items: { label: 'Auto-sell items', desc: 'Automatically sells items that aren\'t needed.' },
  auto_buy_bottles: { label: 'Auto-buy potion bottles', desc: 'Automatically restocks empty bottles for potions.' },
  auto_buy_better_items: { label: 'Buy better items in the shop', desc: 'Automatically buys better equipment from the shop when available.' },
  auto_buy_potions: { label: 'Auto-buy potions', desc: 'Automatically restocks needed potions.' },
  auto_skills: { label: 'Auto-distribute attribute points', desc: 'Automatically distributes new attribute points.' },
  auto_enchant: { label: 'Automate enchanting', desc: 'Automatically enchants equipment when possible.' },
  auto_mount: { label: 'Automate mounts', desc: 'Automatically manages buying/using mounts.' },
  auto_mount_buy_lower: { label: 'Buy cheaper mounts too', desc: 'Also buys cheaper mount tiers when needed.' },
  min_mush_mount: { label: 'Minimum mushroom reserve for mounts', desc: 'Mushrooms kept untouched for mount purchases.' },
  auto_use_life_potions: { label: 'Auto-use life potions', desc: 'Automatically uses life potions.' },
  auto_use_luck_potions: { label: 'Auto-use luck potions', desc: 'Automatically uses luck potions.' },
  auto_use_main_potions: { label: 'Auto-use main potions', desc: 'Automatically uses main attribute potions.' },
  auto_use_const_potions: { label: 'Auto-use constitution potions', desc: 'Automatically uses constitution/stamina potions.' },
  min_mushrooms: { label: 'Minimum mushroom reserve', desc: 'General mushroom reserve not spent automatically.' },
  min_lucky_coins: { label: 'Minimum lucky coin reserve', desc: 'Lucky coins kept in reserve and not spent automatically.' },
  use_mushrooms_mount: { label: 'Use mushrooms for mounts', desc: 'Allows spending mushrooms when buying mounts.' },

  // Notifications
  auto_notify: { label: 'Enable notifications', desc: 'Sends notifications for important events.' },
  notify_discord_webhook: { label: 'Discord webhook URL', desc: 'Target webhook for Discord notifications.' },
  notify_telegram_token: { label: 'Telegram bot token', desc: 'Access token for Telegram notifications.' },
  notify_telegram_chat: { label: 'Telegram chat ID', desc: 'Target chat for Telegram notifications.' },

  // Timing & Behavior
  poll_interval_secs: { label: 'Poll interval (seconds)', desc: 'How often the bot polls the game status.' },
  humanize_enabled: { label: 'Simulate human behavior', desc: 'Adds random delays to make behavior look less bot-like.' },
  humanize_action_delay_min_ms: { label: 'Min. action delay (ms)', desc: 'Lower bound of the random delay between actions.' },
  humanize_action_delay_max_ms: { label: 'Max. action delay (ms)', desc: 'Upper bound of the random delay between actions.' },
  humanize_poll_jitter_pct: { label: 'Poll jitter (%)', desc: 'Random percentage variance applied to the poll interval.' },
  active_hours_enabled: { label: 'Restrict active hours', desc: 'Limits bot operation to specific times of day.' },
  active_hours_start: { label: 'Active from (hour)', desc: 'Start of the allowed operating period.' },
  active_hours_end: { label: 'Active until (hour)', desc: 'End of the allowed operating period.' },
  active_windows: { label: 'Active time windows', desc: 'Detailed list of allowed operating time windows.' },
  diagnostic_logging: { label: 'Diagnostic logging', desc: 'Writes extra diagnostic information to the log.' },
  module_priorities: { label: 'Module priorities', desc: 'Order in which bot modules are prioritized on conflicts.' },
};

function currentLabels() {
  return getLanguage() === 'en' ? LABELS_EN : LABELS_DE;
}

function humanizeKey(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export default {
  id: 'settings',
  label: 'Einstellungen',
  icon: '⚙',
  mount(container, ctx) {
    const css = `
      .settings-page #settings-groups { column-count: 2; column-gap: 14px; }
      .settings-page .group { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 10px 12px; margin-bottom: 10px; break-inside: avoid; display: inline-block; width: 100%; }
      .settings-page .group h3 { margin: 0 0 6px; font-size: 11.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
      .settings-page .row { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 6px 10px; padding: 5px 0; border-bottom: 1px solid var(--border); font-size: 12.5px; }
      .settings-page .row:last-child { border-bottom: none; }
      .settings-page .row-label { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
      .settings-page .row-label-text { font-weight: 500; }
      .settings-page .row-desc { font-size: 11px; color: var(--muted); line-height: 1.3; }
      .settings-page .row-key { font-size: 10px; color: var(--muted); opacity: 0.55; font-family: "Consolas", "SF Mono", monospace; }
      .settings-page .row-input { flex-shrink: 0; }
      .settings-page input[type="number"], .settings-page input[type="text"] { background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 3px 6px; width: 110px; font-size: 12px; }
      .settings-page .save-bar { position: sticky; bottom: 0; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
      .settings-page .readonly-value { color: var(--muted); font-size: 11px; font-family: "Consolas", "SF Mono", monospace; max-width: 160px; overflow-x: auto; white-space: nowrap; }
      @media (max-width: 900px) {
        .settings-page #settings-groups { column-count: 1; }
      }

      .settings-page .templates-card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 12px 14px; margin-bottom: 10px; }
      .settings-page .templates-card h3 { margin: 0 0 4px; font-size: 13px; }
      .settings-page .templates-desc { font-size: 11.5px; color: var(--muted); margin-bottom: 10px; line-height: 1.4; }
      .settings-page .templates-save-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
      .settings-page .templates-save-row input[type="text"] { flex: 1; min-width: 160px; width: auto; background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 7px 10px; font-size: 13px; }
      .settings-page #templates-status { font-size: 11.5px; color: var(--muted); margin-bottom: 8px; }
      .settings-page .template-row { border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
      .settings-page .template-row:last-child { margin-bottom: 0; }
      .settings-page .template-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; }
      .settings-page .template-name { font-weight: 600; font-size: 13px; }
      .settings-page .template-meta { font-size: 11px; margin-left: 8px; }
      .settings-page .template-actions { display: flex; gap: 6px; flex-wrap: wrap; }
      .settings-page .template-actions button { width: auto; padding: 5px 12px; font-size: 11.5px; }
      .settings-page .template-apply-panel { display: none; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); }
      .settings-page .template-apply-panel.open { display: block; }
      .settings-page .template-target-list { display: flex; flex-direction: column; gap: 4px; max-height: 180px; overflow-y: auto; margin-bottom: 8px; }
      .settings-page .template-target-list label { display: flex; align-items: center; gap: 8px; font-size: 12.5px; cursor: pointer; }
      .settings-page .templates-empty { color: var(--muted); font-size: 12.5px; }
      .settings-page .btn-secondary { background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 8px; cursor: pointer; }
      .settings-page .btn-danger { background: transparent; border: 1px solid var(--red); color: var(--red); border-radius: 8px; cursor: pointer; }

      .settings-page .marketplace-card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 12px 14px; margin-bottom: 10px; }
      .settings-page .marketplace-card h3 { margin: 0 0 4px; font-size: 13px; }
      .settings-page .marketplace-desc { font-size: 11.5px; color: var(--muted); margin-bottom: 10px; line-height: 1.4; }
      .settings-page .marketplace-filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
      .settings-page .marketplace-filters input[type="text"], .settings-page .marketplace-filters select { background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 6px 10px; font-size: 12.5px; width: auto; }
      .settings-page #marketplace-status { font-size: 11.5px; color: var(--muted); margin-bottom: 8px; }
      .settings-page .marketplace-empty { color: var(--muted); font-size: 12.5px; }
      .settings-page .marketplace-item { border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
      .settings-page .marketplace-item:last-child { margin-bottom: 0; }
      .settings-page .marketplace-item-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; }
      .settings-page .marketplace-item-title { font-weight: 600; font-size: 13px; }
      .settings-page .marketplace-item-desc { font-size: 11.5px; color: var(--muted); margin: 4px 0; }
      .settings-page .marketplace-item-meta { font-size: 11px; color: var(--muted); display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; }
      .settings-page .marketplace-tag { display: inline-block; background: var(--panel-2); border-radius: 10px; padding: 1px 8px; font-size: 10.5px; margin-right: 4px; }
      .settings-page .marketplace-rating-stars { cursor: pointer; }
      .settings-page .marketplace-rating-stars .star { opacity: 0.35; }
      .settings-page .marketplace-rating-stars .star.filled { opacity: 1; }
      .settings-page .publish-form { display: none; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); }
      .settings-page .publish-form.open { display: block; }
      .settings-page .publish-form input[type="text"] { width: 100%; margin-bottom: 6px; background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 6px 10px; font-size: 12.5px; }
    `;
    ctx.injectStyleOnce('settings', css);

    const wrap = document.createElement('div');
    wrap.className = 'settings-page';
    wrap.innerHTML = `
      <h1 class="page-title">${t('settings.title')}</h1>
      <div class="templates-card">
        <h3>${t('settings.templatesTitle')}</h3>
        <div class="templates-desc">${t('settings.templatesDesc')}</div>
        <div class="templates-save-row">
          <input type="text" id="template-name-input" placeholder="${t('settings.templateNamePlaceholder')}" />
          <button class="btn btn-primary" id="template-save-btn" style="width:auto;padding:7px 16px;">${t('settings.saveCurrentBtn')}</button>
          <button class="btn-secondary" id="template-import-btn" style="width:auto;padding:7px 16px;">${t('settings.importBtn')}</button>
          <input type="file" id="template-import-file" accept="application/json,.json" hidden />
        </div>
        <div id="templates-status"></div>
        <div id="templates-list">${t('common.loading')}</div>
      </div>
      <div class="marketplace-card">
        <h3>${t('settings.marketplaceTitle')}</h3>
        <div class="marketplace-desc">${t('settings.marketplaceDesc')}</div>
        <div class="marketplace-filters">
          <input type="text" id="marketplace-search" placeholder="${t('settings.marketplaceSearchPlaceholder')}" />
          <select id="marketplace-class-filter"><option value="">${t('settings.marketplaceClassAll')}</option></select>
          <input type="text" id="marketplace-tag-filter" placeholder="${t('settings.marketplaceTagPlaceholder')}" />
          <select id="marketplace-sort">
            <option value="new">${t('settings.marketplaceSortNew')}</option>
            <option value="rating">${t('settings.marketplaceSortRating')}</option>
            <option value="downloads">${t('settings.marketplaceSortDownloads')}</option>
          </select>
        </div>
        <div id="marketplace-status"></div>
        <div id="marketplace-list">${t('common.loading')}</div>
      </div>
      <div id="settings-body"><div id="settings-groups">${t('common.loading')}</div></div>`;
    container.appendChild(wrap);

    function escapeHtml(s) {
      return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    let allAccounts = [];
    let hasCurrentSettings = false;
    let marketplaceInstanceId = null;
    ctx.fetchJSON('/api/marketplace-identity').then(data => { marketplaceInstanceId = data.instanceId; });

    function fmtDate(iso) {
      return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    async function loadTemplates() {
      const listEl = wrap.querySelector('#templates-list');
      let list;
      try {
        [list, allAccounts] = await Promise.all([
          ctx.fetchJSON('/api/settings-templates'),
          ctx.fetchJSON('/api/accounts'),
        ]);
      } catch (err) {
        listEl.textContent = t('analytics.loadError', { message: err.message });
        return;
      }
      if (!list.length) {
        listEl.innerHTML = `<div class="templates-empty">${t('settings.templatesEmpty')}</div>`;
        return;
      }
      listEl.innerHTML = list.map(tpl => `
        <div class="template-row" data-id="${tpl.id}">
          <div class="template-head">
            <span><span class="template-name char-name">${escapeHtml(tpl.name)}</span><span class="muted template-meta">${t('settings.templateMeta', { count: tpl.fieldCount, date: fmtDate(tpl.createdAt) })}</span></span>
            <div class="template-actions">
              <button class="btn-secondary" data-action="toggle-apply">${t('settings.applyTemplateBtn')}</button>
              <button class="btn-secondary" data-action="toggle-publish">${t('settings.marketplacePublishBtn')}</button>
              <button class="btn-danger" data-action="delete">${t('settings.deleteBtn')}</button>
            </div>
          </div>
          <div class="template-apply-panel" data-role="apply-panel">
            <div class="template-target-list">
              ${allAccounts.map(acc => `
                <label><input type="checkbox" value="${escapeHtml(acc.id)}" /> <span class="char-name">${escapeHtml(acc.charName)}</span> <span class="muted">(${escapeHtml(acc.server)})</span></label>
              `).join('') || `<span class="muted">${t('settings.noAccounts')}</span>`}
            </div>
            <button class="btn btn-primary" data-action="confirm-apply" style="width:auto;padding:6px 14px;font-size:12px;">${t('settings.applySelectedBtn')}</button>
            <span data-role="apply-status" class="muted" style="margin-left:8px;font-size:11.5px;"></span>
          </div>
          <div class="publish-form" data-role="publish-form">
            <input type="text" data-field="title" placeholder="${t('settings.marketplacePublishTitleLabel')}" value="${escapeHtml(tpl.name)}" />
            <input type="text" data-field="description" placeholder="${t('settings.marketplacePublishDescLabel')}" />
            <input type="text" data-field="tags" placeholder="${t('settings.marketplacePublishTagsLabel')}" />
            <input type="text" data-field="displayName" placeholder="${t('settings.marketplacePublishNameLabel')}" />
            <button class="btn btn-primary" data-action="confirm-publish" style="width:auto;padding:6px 14px;font-size:12px;">${t('settings.marketplacePublishSubmitBtn')}</button>
            <button class="btn-secondary" data-action="cancel-publish" style="width:auto;padding:6px 14px;font-size:12px;">${t('settings.marketplacePublishCancelBtn')}</button>
            <span data-role="publish-status" class="muted" style="margin-left:8px;font-size:11.5px;"></span>
          </div>
        </div>`).join('');

      listEl.querySelectorAll('.template-row').forEach(row => {
        const id = row.dataset.id;
        row.querySelector('[data-action="toggle-apply"]').addEventListener('click', () => {
          row.querySelector('[data-role="apply-panel"]').classList.toggle('open');
        });
        row.querySelector('[data-action="toggle-publish"]').addEventListener('click', () => {
          row.querySelector('[data-role="publish-form"]').classList.toggle('open');
        });
        row.querySelector('[data-action="cancel-publish"]').addEventListener('click', () => {
          row.querySelector('[data-role="publish-form"]').classList.remove('open');
        });
        row.querySelector('[data-action="confirm-publish"]').addEventListener('click', async () => {
          const form = row.querySelector('[data-role="publish-form"]');
          const statusEl = form.querySelector('[data-role="publish-status"]');
          const title = form.querySelector('[data-field="title"]').value.trim();
          const description = form.querySelector('[data-field="description"]').value.trim();
          const tags = form.querySelector('[data-field="tags"]').value.split(',').map(s => s.trim()).filter(Boolean);
          const displayName = form.querySelector('[data-field="displayName"]').value.trim();
          if (!title) { statusEl.textContent = t('settings.marketplaceTitleRequired'); return; }
          statusEl.textContent = t('settings.marketplacePublishing');
          try {
            await ctx.fetchJSON(`/api/marketplace-publish/${encodeURIComponent(id)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title, description, tags, displayName }),
            });
            statusEl.textContent = t('settings.marketplacePublished');
            await loadMarketplace();
          } catch (err) {
            statusEl.textContent = t('settings.marketplacePublishFailed', { message: err.message });
          }
        });
        row.querySelector('[data-action="delete"]').addEventListener('click', async () => {
          if (!confirm(t('settings.confirmDeleteTemplate'))) return;
          try {
            await ctx.fetchJSON(`/api/settings-templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
            await loadTemplates();
          } catch (err) {
            alert(t('settings.deleteFailed', { message: err.message }));
          }
        });
        row.querySelector('[data-action="confirm-apply"]').addEventListener('click', async () => {
          const statusEl = row.querySelector('[data-role="apply-status"]');
          const accountIds = [...row.querySelectorAll('.template-target-list input:checked')].map(cb => cb.value);
          if (!accountIds.length) { statusEl.textContent = t('settings.selectAtLeastOne'); return; }
          statusEl.textContent = t('settings.applying');
          try {
            await ctx.fetchJSON(`/api/settings-templates/${encodeURIComponent(id)}/apply`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accountIds }),
            });
            statusEl.textContent = t('settings.appliedToCount', { count: accountIds.length });
            if (accountIds.includes(ctx.getAccountId())) load();
          } catch (err) {
            statusEl.textContent = t('analytics.loadError', { message: err.message });
          }
        });
      });
    }

    wrap.querySelector('#template-save-btn').addEventListener('click', async () => {
      const status = wrap.querySelector('#templates-status');
      const nameInput = wrap.querySelector('#template-name-input');
      const accountId = ctx.getAccountId();
      const name = nameInput.value.trim();
      if (!name) { status.textContent = t('settings.nameRequired'); return; }
      if (!accountId || !hasCurrentSettings) { status.textContent = t('settings.noLoadedSettings'); return; }
      status.textContent = t('settings.saving');
      try {
        await ctx.fetchJSON('/api/settings-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, accountId }),
        });
        status.textContent = t('settings.templateSaved', { name });
        nameInput.value = '';
        await loadTemplates();
      } catch (err) {
        status.textContent = t('analytics.loadError', { message: err.message });
      }
    });

    const importBtn = wrap.querySelector('#template-import-btn');
    const importFile = wrap.querySelector('#template-import-file');
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', async () => {
      const file = importFile.files[0];
      importFile.value = '';
      if (!file) return;
      const status = wrap.querySelector('#templates-status');
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const settings = parsed && typeof parsed.botConfig === 'object' ? parsed.botConfig : parsed;
        if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
          throw new Error(t('settings.invalidImportFile'));
        }
        const defaultName = file.name.replace(/\.json$/i, '');
        const name = prompt(t('settings.importNamePrompt'), defaultName);
        if (!name || !name.trim()) return;
        status.textContent = t('settings.importing');
        await ctx.fetchJSON('/api/settings-templates/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), settings }),
        });
        status.textContent = t('settings.templateImported', { name: name.trim() });
        await loadTemplates();
      } catch (err) {
        status.textContent = t('settings.importFailed', { message: err.message });
      }
    });

    // --- Marktplatz ---
    const MARKETPLACE_URL = 'https://data.poslab.cc/api/marketplace';
    let marketplaceClassesLoaded = false;

    function starsHtml(itemId, ratingAvg) {
      const rounded = ratingAvg != null ? Math.round(ratingAvg) : 0;
      let html = `<span class="marketplace-rating-stars" data-id="${itemId}">`;
      for (let i = 1; i <= 5; i++) {
        html += `<span class="star${i <= rounded ? ' filled' : ''}" data-stars="${i}">★</span>`;
      }
      html += '</span>';
      return html;
    }

    async function loadMarketplace() {
      const listEl = wrap.querySelector('#marketplace-list');
      const status = wrap.querySelector('#marketplace-status');
      const q = wrap.querySelector('#marketplace-search').value.trim();
      const characterClass = wrap.querySelector('#marketplace-class-filter').value;
      const tag = wrap.querySelector('#marketplace-tag-filter').value.trim();
      const sort = wrap.querySelector('#marketplace-sort').value;

      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (characterClass) params.set('characterClass', characterClass);
      if (tag) params.set('tag', tag);
      if (sort) params.set('sort', sort);

      let items;
      try {
        const res = await fetch(`${MARKETPLACE_URL}/templates?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        items = await res.json();
      } catch (err) {
        status.textContent = t('settings.marketplaceLoadError', { message: err.message });
        return;
      }
      status.textContent = '';

      if (!marketplaceClassesLoaded) {
        const classSelect = wrap.querySelector('#marketplace-class-filter');
        const classes = [...new Set(items.map(i => i.characterClass).filter(Boolean))].sort();
        classSelect.innerHTML = `<option value="">${t('settings.marketplaceClassAll')}</option>` +
          classes.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
        marketplaceClassesLoaded = true;
      }

      listEl.innerHTML = items.length
        ? items.map(item => `
          <div class="marketplace-item" data-id="${item.id}">
            <div class="marketplace-item-head">
              <span class="marketplace-item-title">${escapeHtml(item.title)}</span>
              <button class="btn-secondary" data-action="import" style="width:auto;padding:5px 12px;font-size:11.5px;">${t('settings.marketplaceImportBtn')}</button>
            </div>
            ${item.description ? `<div class="marketplace-item-desc">${escapeHtml(item.description)}</div>` : ''}
            <div class="marketplace-item-meta">
              ${item.characterClass ? `<span>${escapeHtml(item.characterClass)}</span>` : ''}
              ${item.tags.map(tg => `<span class="marketplace-tag">${escapeHtml(tg)}</span>`).join('')}
              <span>${t('settings.marketplaceDownloadsLabel', { count: item.downloads })}</span>
              ${item.displayName ? `<span>${escapeHtml(item.displayName)}</span>` : ''}
            </div>
            <div class="marketplace-item-meta">
              <span>${t('settings.marketplaceRatingLabel')}</span>
              ${starsHtml(item.id, item.ratingAvg)}
              ${item.ratingCount ? `<span>(${item.ratingAvg} · ${item.ratingCount})</span>` : ''}
            </div>
          </div>
        `).join('')
        : `<div class="marketplace-empty">${t('settings.marketplaceEmpty')}</div>`;

      listEl.querySelectorAll('.marketplace-item').forEach(itemEl => {
        const id = itemEl.dataset.id;
        itemEl.querySelector('[data-action="import"]').addEventListener('click', async () => {
          status.textContent = t('settings.marketplaceImporting');
          try {
            const res = await fetch(`${MARKETPLACE_URL}/templates/${encodeURIComponent(id)}/download`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            await ctx.fetchJSON('/api/settings-templates/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: data.title, settings: data.settings }),
            });
            status.textContent = t('settings.marketplaceImported', { name: data.title });
            await loadTemplates();
            await loadMarketplace();
          } catch (err) {
            status.textContent = t('settings.marketplaceLoadError', { message: err.message });
          }
        });

        itemEl.querySelectorAll('.marketplace-rating-stars .star').forEach(starEl => {
          starEl.addEventListener('click', async () => {
            const stars = Number(starEl.dataset.stars);
            try {
              const res = await fetch(`${MARKETPLACE_URL}/templates/${encodeURIComponent(id)}/rating`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instanceId: marketplaceInstanceId, stars }),
              });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              status.textContent = t('settings.marketplaceRatingSaved');
              await loadMarketplace();
            } catch (err) {
              status.textContent = t('settings.marketplaceLoadError', { message: err.message });
            }
          });
        });
      });
    }

    ['marketplace-search', 'marketplace-class-filter', 'marketplace-tag-filter', 'marketplace-sort'].forEach(id => {
      const el = wrap.querySelector(`#${id}`);
      el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => loadMarketplace());
    });

    loadTemplates();
    loadMarketplace();

    let pending = {};

    async function load() {
      const accountId = ctx.getAccountId();
      const body = wrap.querySelector('#settings-body');
      pending = {};
      hasCurrentSettings = false;
      if (!accountId) { body.textContent = t('analytics.noAccountSelected'); return; }
      try {
        const settings = await ctx.fetchJSON(`/api/settings/${encodeURIComponent(accountId)}`);
        hasCurrentSettings = true;
        render(body, settings);
      } catch (err) {
        body.innerHTML = /Keine Einstellungen/i.test(err.message)
          ? `<p class="muted">${t('settings.noSettingsYet')}</p>`
          : `<p class="muted">${t('analytics.loadError', { message: escapeHtml(err.message) })}</p>`;
      }
    }

    function renderField(key, value) {
      if (typeof value === 'boolean') {
        return `<input type="checkbox" data-key="${key}" data-type="boolean" ${value ? 'checked' : ''} />`;
      }
      if (typeof value === 'number') {
        return `<input type="number" data-key="${key}" data-type="number" value="${value}" />`;
      }
      if (typeof value === 'string') {
        return `<input type="text" data-key="${key}" data-type="string" value="${escapeHtml(value)}" />`;
      }
      // Arrays/Objekte: nur zur vollständigen Übersicht angezeigt, nicht editierbar
      // (sichere Bearbeitung beliebiger JSON-Strukturen ist über ein einfaches Formular nicht sinnvoll möglich).
      return `<span class="readonly-value" title="${t('settings.readOnlyTitle')}">${escapeHtml(JSON.stringify(value))}</span>`;
    }

    function render(body, settings) {
      const groups = {};
      for (const [key, value] of Object.entries(settings)) {
        const g = groupKey(key);
        (groups[g] = groups[g] || []).push([key, value]);
      }
      const orderedGroups = GROUP_ORDER.filter(g => groups[g]).map(g => [g, groups[g]]);

      body.innerHTML = `<div id="settings-groups">` + orderedGroups.map(([g, entries]) => `
        <div class="group">
          <h3>${groupLabels()[g] || g}</h3>
          ${entries.map(([key, value]) => {
            const meta = currentLabels()[key];
            const label = meta ? meta.label : humanizeKey(key);
            const desc = meta && meta.desc ? `<span class="row-desc">${escapeHtml(meta.desc)}</span>` : '';
            return `
            <div class="row">
              <div class="row-label">
                <span class="row-label-text">${escapeHtml(label)}</span>
                ${desc}
                <span class="row-key">${key}</span>
              </div>
              <div class="row-input">${renderField(key, value)}</div>
            </div>`;
          }).join('')}
        </div>`).join('') + `</div>
        <div class="save-bar">
          <span id="settings-status" class="muted"></span>
          <button class="btn btn-primary" id="settings-save" style="width:auto;padding:8px 20px;">${t('settings.saveBtn')}</button>
        </div>`;

      body.querySelectorAll('input[data-key]').forEach(input => {
        input.addEventListener('change', () => {
          const key = input.dataset.key;
          const type = input.dataset.type;
          pending[key] = type === 'boolean' ? input.checked : type === 'number' ? Number(input.value) : input.value;
        });
      });

      body.querySelector('#settings-save').addEventListener('click', async () => {
        const status = body.querySelector('#settings-status');
        status.textContent = t('settings.saving');
        try {
          const accountId = ctx.getAccountId();
          await ctx.fetchJSON(`/api/settings/${encodeURIComponent(accountId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pending),
          });
          status.textContent = t('settings.saved');
          pending = {};
        } catch (err) {
          status.textContent = t('analytics.loadError', { message: err.message });
        }
      });
    }

    load();
    const unsub = ctx.onAccountChange(load);
    return () => unsub();
  }
};
