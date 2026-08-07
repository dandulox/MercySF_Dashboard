const GROUP_ORDER = ['quest', 'arena', 'dungeon', 'fortress', 'underworld', 'pets', 'guild', 'world_boss', 'timing', 'notifications', 'sonstiges'];

const GROUP_LABELS = {
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
const LABELS = {
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
      .settings-page .group { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; margin-bottom: 12px; break-inside: avoid; display: inline-block; width: 100%; }
      .settings-page .group h3 { margin: 0 0 6px; font-size: 11.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
      .settings-page .row { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 5px 0; border-bottom: 1px solid var(--border); font-size: 12.5px; }
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
      .settings-page .panel-settings-card { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; }
      .settings-page .panel-settings-card h3 { margin: 0 0 4px; font-size: 13px; }
      .settings-page .panel-settings-desc { font-size: 11.5px; color: var(--muted); margin-bottom: 10px; line-height: 1.4; }
      .settings-page .panel-settings-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .settings-page .panel-settings-row select { background: var(--panel-2); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 6px 10px; font-size: 13px; }
      .settings-page #panel-settings-status { font-size: 11.5px; color: var(--muted); }
    `;
    ctx.injectStyleOnce('settings', css);

    const wrap = document.createElement('div');
    wrap.className = 'settings-page';
    wrap.innerHTML = `
      <h1 class="page-title">Einstellungen</h1>
      <div class="panel-settings-card">
        <h3>⚙ Panel-Einstellungen</h3>
        <div class="panel-settings-desc">Wie oft die sf-api-Bridge live abgefragt wird (Ausrüstung, Spielstand). Seltener abfragen reduziert das Risiko zusätzlicher, außerplanmäßiger Logins.</div>
        <div class="panel-settings-row">
          <select id="gamestate-interval-select"><option>Lade...</option></select>
          <button class="btn btn-primary" id="gamestate-interval-save" style="width:auto;padding:7px 16px;">Übernehmen</button>
          <span id="panel-settings-status"></span>
        </div>
      </div>
      <div id="settings-body"><div id="settings-groups">Lade...</div></div>`;
    container.appendChild(wrap);

    async function loadPanelSettings() {
      const select = wrap.querySelector('#gamestate-interval-select');
      const status = wrap.querySelector('#panel-settings-status');
      try {
        const data = await ctx.fetchJSON('/api/panel-settings');
        select.innerHTML = data.presets.map(p =>
          `<option value="${p.key}" ${p.key === data.current ? 'selected' : ''}>${p.label}</option>`).join('');
      } catch (err) {
        status.textContent = 'Fehler: ' + err.message;
      }
    }

    wrap.querySelector('#gamestate-interval-save').addEventListener('click', async () => {
      const select = wrap.querySelector('#gamestate-interval-select');
      const status = wrap.querySelector('#panel-settings-status');
      status.textContent = 'Speichere...';
      try {
        await ctx.fetchJSON('/api/panel-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preset: select.value }),
        });
        status.textContent = 'Übernommen.';
      } catch (err) {
        status.textContent = 'Fehler: ' + err.message;
      }
    });

    loadPanelSettings();

    let pending = {};

    async function load() {
      const accountId = ctx.getAccountId();
      const body = wrap.querySelector('#settings-body');
      pending = {};
      if (!accountId) { body.textContent = 'Kein Account ausgewählt.'; return; }
      try {
        const settings = await ctx.fetchJSON(`/api/settings/${encodeURIComponent(accountId)}`);
        render(body, settings);
      } catch (err) {
        body.textContent = 'Fehler: ' + err.message;
      }
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
      return `<span class="readonly-value" title="Nur lesbar">${escapeHtml(JSON.stringify(value))}</span>`;
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
          <h3>${GROUP_LABELS[g] || g}</h3>
          ${entries.map(([key, value]) => {
            const meta = LABELS[key];
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
          <button class="btn btn-primary" id="settings-save" style="width:auto;padding:8px 20px;">Speichern</button>
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
        status.textContent = 'Speichere...';
        try {
          const accountId = ctx.getAccountId();
          await ctx.fetchJSON(`/api/settings/${encodeURIComponent(accountId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pending),
          });
          status.textContent = 'Gespeichert.';
          pending = {};
        } catch (err) {
          status.textContent = 'Fehler: ' + err.message;
        }
      });
    }

    load();
    const unsub = ctx.onAccountChange(load);
    return () => unsub();
  }
};
