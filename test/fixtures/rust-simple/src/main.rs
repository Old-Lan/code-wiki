mod models;
mod service;

use service::UserService;
use std::collections::HashMap;

fn main() {
    let user = UserService::create("Alice".to_string(), "alice@example.com".to_string());
    println!("{:?}", user);
}
