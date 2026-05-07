require_relative 'user'
require 'sinatra'

module MyApp
  class UserService
    def initialize
      @users = []
    end

    def all
      @users
    end

    def find(id)
      @users.find { |u| u.id == id }
    end

    def create(name, email)
      user = User.new(@users.length + 1, name, email)
      @users << user
      user
    end
  end
end
