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

class Element
  def show?
    not hidden?
  end

  def hidden?
    self.css(:display) == 'none'
  end
end

Document.on(:click) do
  paragraph = Element.id(Lemonade::Entity::ID_TAILK)
  return Lemonade::Event.exec if paragraph.nil? || paragraph.show?
  paragraph.toggle
end

Document.on(:contextmenu) do
  paragraph = Element.id(Lemonade::Entity::ID_TAILK)
  paragraph.toggle if paragraph
  return false
end
