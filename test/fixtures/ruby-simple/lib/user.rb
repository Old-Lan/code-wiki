require 'json'

module MyApp
  class User
    attr_accessor :id, :name, :email

    def initialize(id, name, email)
      @id = id
      @name = name
      @email = email
    end

    def to_hash
      { id: @id, name: @name, email: @email }
    end

    def self.from_hash(hash)
      User.new(hash[:id], hash[:name], hash[:email])
    end

    private

    def validate_email
      @email.include?('@')
    end
  end

  MAX_USERS = 100
end
