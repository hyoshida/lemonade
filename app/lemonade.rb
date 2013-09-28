require 'opal'
require 'opal-jquery'
require 'json'

require 'javascript_importer'

JavascriptImporter.new(%w{
  https://rawgithub.com/giuliandrimba/jquery-lettering-animate/master/example/js/jquery.lettering.js
  https://rawgithub.com/giuliandrimba/jquery-lettering-animate/master/example/js/jquery.lettering.animate.js
}).exec

require 'lemonade/element'
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

def on_left_click
  message_box = Lemonade::MessageBox.find
  return Lemonade::Event.exec if message_box.nil? || message_box.show?
  message_box.toggle
end

def on_right_click
  message_box = Lemonade::MessageBox.find
  message_box.toggle if message_box
end

def on_wheel_click
  message_box = Lemonade::MessageBox.find
  message_box.toggle if message_box
end

Document.on(:mousedown) do |event|
  case event.which
  when 1 then on_left_click
  when 3 then on_right_click
  when 2 then on_wheel_click
  end
  `#{event}.preventDefault();`
end

Document.on(:contextmenu) do |event|
  `#{event}.preventDefault();`
end
