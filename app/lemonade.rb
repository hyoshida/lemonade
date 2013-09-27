require 'opal'
require 'opal-jquery'
require 'json'

require 'javascript_importer'

JavascriptImporter.new(%w{
  https://rawgithub.com/giuliandrimba/jquery-lettering-animate/master/example/js/jquery.lettering.js
  https://rawgithub.com/giuliandrimba/jquery-lettering-animate/master/example/js/jquery.lettering.animate.js
}).exec

require 'lemonade/entity'
require 'lemonade/event'
require 'lemonade/story'
require 'lemonade/dsl'

class Anima
  include Lemonade::Entity
end

Document.on(:click) do
  Lemonade::Event.exec
end
