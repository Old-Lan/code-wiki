package com.example;

import com.example.model.User;
import com.example.service.UserService;
import java.util.List;

public class App {
    public static void main(String[] args) {
        UserService service = new UserService();
        List<User> users = service.getAllUsers();
        System.out.println(users);
    }
}
