package com.example.service;

import com.example.model.User;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    public List<User> getAllUsers() {
        return new ArrayList<>();
    }

    public User getUserById(Long id) {
        return null;
    }

    public User createUser(String name, String email) {
        return new User(1L, name, email);
    }
}
