require_relative 'service'

class App < Sinatra::Base
  get '/users' do
    service = MyApp::UserService.new
    service.all.to_json
  end
end
