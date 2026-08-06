use axum::{
    extract::Json,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::post,
    Router,
};
use serde::{Deserialize, Serialize};
use sf_api::command::Command;
use sf_api::session::SimpleSession;
use std::collections::BTreeMap;

#[derive(Deserialize)]
struct StateRequest {
    username: String,
    password: String,
    server: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EquipmentItem {
    slot: String,
    item_type: String,
    model_id: u16,
    required_class: Option<String>,
    attributes: BTreeMap<String, u32>,
    gem_slot: Option<String>,
    rune: Option<String>,
    enchantment: Option<String>,
    upgrade_count: u8,
    item_quality: u32,
    is_washed: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GuildMember {
    name: String,
    level: u16,
    guild_rank: String,
    last_online: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GuildInfo {
    name: String,
    description: String,
    honor: u32,
    rank: u32,
    member_count: usize,
    members: Vec<GuildMember>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct QuestInfo {
    location: String,
    base_silver: u32,
    base_experience: u32,
    base_length_sec: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TavernInfo {
    beer_drunk: u8,
    beer_max: u8,
    thirst_for_adventure_sec: u32,
    current_action: String,
    quests: Vec<QuestInfo>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MailEntry {
    from: String,
    title: String,
    date: String,
    read: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MailInfo {
    inbox_capacity: u16,
    unread_count: usize,
    recent: Vec<MailEntry>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StateResponse {
    character_name: String,
    equipment: Vec<EquipmentItem>,
    guild: Option<GuildInfo>,
    tavern: TavernInfo,
    mail: MailInfo,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

fn error_response(status: StatusCode, message: String) -> Response {
    (status, Json(ErrorResponse { error: message })).into_response()
}

async fn state_handler(Json(req): Json<StateRequest>) -> Response {
    // Mercy-SF-Logins sind S&F-Accounts (SSO) — ein Login kann mehrere Charaktere auf
    // verschiedenen Servern haben (siehe accountsRegistry.js). login_sf_account() gibt eine
    // Session pro Charakter zurück; wir wählen die, deren Server zum Profil passt.
    let sessions = match SimpleSession::login_sf_account(&req.username, &req.password).await {
        Ok(s) => s,
        Err(e) => {
            return error_response(
                StatusCode::UNAUTHORIZED,
                format!("Login fehlgeschlagen: {e}"),
            )
        }
    };

    let mut session = match sessions
        .into_iter()
        .find(|s| s.server_url().host_str() == Some(req.server.as_str()))
    {
        Some(s) => s,
        None => {
            return error_response(
                StatusCode::NOT_FOUND,
                format!("Kein Charakter auf Server {} für diesen Login gefunden", req.server),
            )
        }
    };

    let game_state = match session.send_command(Command::Update).await {
        Ok(gs) => gs,
        Err(e) => {
            return error_response(
                StatusCode::BAD_GATEWAY,
                format!("Abfrage fehlgeschlagen: {e}"),
            )
        }
    };

    // --- Ausrüstung ---
    let character = &game_state.character;
    let mut equipment = Vec::new();
    for (slot, item_opt) in character.equipment.0.iter() {
        let Some(item) = item_opt else { continue };
        let mut attributes = BTreeMap::new();
        for (attr, value) in item.attributes.iter() {
            if *value > 0 {
                attributes.insert(format!("{attr:?}"), *value);
            }
        }
        equipment.push(EquipmentItem {
            slot: format!("{slot:?}"),
            item_type: format!("{:?}", item.typ),
            model_id: item.model_id,
            required_class: item.class.map(|c| format!("{c:?}")),
            attributes,
            gem_slot: item.gem_slot.map(|g| format!("{g:?}")),
            rune: item.rune.as_ref().map(|r| format!("{r:?}")),
            enchantment: item.enchantment.map(|e| format!("{e:?}")),
            upgrade_count: item.upgrade_count,
            item_quality: item.item_quality,
            is_washed: item.is_washed,
        });
    }

    // --- Gilde ---
    let guild = game_state.guild.as_ref().map(|g| GuildInfo {
        name: g.name.clone(),
        description: g.description.clone(),
        honor: g.honor,
        rank: g.rank,
        member_count: g.members.len(),
        members: g
            .members
            .iter()
            .map(|m| GuildMember {
                name: m.name.clone(),
                level: m.level,
                guild_rank: format!("{:?}", m.guild_rank),
                last_online: m.last_online.map(|d| d.to_rfc3339()),
            })
            .collect(),
    });

    // --- Taverne ---
    let t = &game_state.tavern;
    let tavern = TavernInfo {
        beer_drunk: t.beer_drunk,
        beer_max: t.beer_max,
        thirst_for_adventure_sec: t.thirst_for_adventure_sec,
        current_action: format!("{:?}", t.current_action),
        quests: t
            .quests
            .iter()
            .map(|q| QuestInfo {
                location: format!("{:?}", q.location_id),
                base_silver: q.base_silver,
                base_experience: q.base_experience,
                base_length_sec: q.base_length,
            })
            .collect(),
    };

    // --- Mail ---
    let m = &game_state.mail;
    let mail = MailInfo {
        inbox_capacity: m.inbox_capacity,
        unread_count: m.inbox.iter().filter(|e| !e.read).count(),
        recent: m
            .inbox
            .iter()
            .rev()
            .take(10)
            .map(|e| MailEntry {
                from: e.from.clone(),
                title: e.title.clone(),
                date: e.date.to_rfc3339(),
                read: e.read,
            })
            .collect(),
    };

    Json(StateResponse {
        character_name: character.name.clone(),
        equipment,
        guild,
        tavern,
        mail,
    })
    .into_response()
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/state", post(state_handler));
    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], 4001));
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    println!("mercy-sfapi-bridge listening on {addr}");
    axum::serve(listener, app).await.unwrap();
}
