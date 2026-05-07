use crate::models::{User, Status, validate_email};

pub struct UserService;

impl UserService {
    pub fn create(name: String, email: String) -> User {
        User { id: 1, name, email }
    }

    pub fn get_by_id(id: u64) -> Option<User> {
        None
    }
}

pub trait Repository<T> {
    fn find_by_id(&self, id: u64) -> Option<T>;
    fn save(&self, item: &T) -> bool;
}
