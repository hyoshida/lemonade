require 'opal'
require 'opal-jquery'
require 'json'

require 'javascript_importer'

JavascriptImporter.new(%w{
  https://rawgithub.com/giuliandrimba/jquery-lettering-animate/master/example/js/jquery.lettering.js
  https://rawgithub.com/giuliandrimba/jquery-lettering-animate/master/example/js/jquery.lettering.animate.js
  https://rawgithub.com/rstacruz/jquery.transit/master/jquery.transit.js
}).exec

require 'lemonade/element'
require 'lemonade/entity'
require 'lemonade/event'
require 'lemonade/story'
require 'lemonade/dsl'

class Element
  def show?
    not hidden?
  end

  def hidden?
    self.css(:display) == 'none'
  end

  def transition(params, &block)
    speed = params.has_key?(:speed) ? params.delete(:speed) : 400
    %x{
      #{self}.transition(#{params.to_n}, #{speed}, function() {
        #{block.call if block_given?}
      })
    }
  end

  # XXX: effectに渡したブロックが正常に動作しないのでanimateを利用する
  def fade_in(options={}, &block)
    self.css(:opacity, 0)
    self.css(:display, 'block')
    self.transition(options.merge(opacity: 1, speed: options[:duration]), &block)
  end

  def fade_out(options={}, &block)
    self.transition(options.merge(opacity: 0, speed: options[:duration])) do
      self.css(:display, 'none')
      block.call if block_given?
    end
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

Document.on(:touchstart) do |event|
  on_left_click
  `#{event}.preventDefault();`
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
