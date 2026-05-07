use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct User {
    pub id: u64,
    pub name: String,
    pub email: String,
}

#[derive(Debug)]
pub enum Status {
    Active,
    Inactive,
}

pub type UserId = u64;

pub const MAX_RETRIES: u32 = 3;

pub fn validate_email(email: &str) -> bool {
    email.contains('@')
}
