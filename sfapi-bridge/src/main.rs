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
struct EquipmentRequest {
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
struct EquipmentResponse {
    character_name: String,
    items: Vec<EquipmentItem>,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

fn error_response(status: StatusCode, message: String) -> Response {
    (status, Json(ErrorResponse { error: message })).into_response()
}

async fn equipment_handler(Json(req): Json<EquipmentRequest>) -> Response {
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

    let character = &game_state.character;
    let mut items = Vec::new();
    for (slot, item_opt) in character.equipment.0.iter() {
        let Some(item) = item_opt else { continue };
        let mut attributes = BTreeMap::new();
        for (attr, value) in item.attributes.iter() {
            if *value > 0 {
                attributes.insert(format!("{attr:?}"), *value);
            }
        }
        items.push(EquipmentItem {
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

    Json(EquipmentResponse {
        character_name: character.name.clone(),
        items,
    })
    .into_response()
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/equipment", post(equipment_handler));
    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], 4001));
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    println!("mercy-sfapi-bridge listening on {addr}");
    axum::serve(listener, app).await.unwrap();
}
