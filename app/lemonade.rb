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

def step
  message_box = Lemonade::MessageBox.find
  return Lemonade::Event.exec if message_box.nil? || message_box.show?
  message_box.toggle
end

def on_step_event
  Document.on(:step) { step unless Lemonade::Talk.reset_lettering }
end

def off_step_event
  Document.off(:step)
end

def toggle_mesage_box
  message_box = Lemonade::MessageBox.find
  message_box.toggle if message_box
end

Document.ready? do
  on_step_event

  Document.on(:touchstart) do |event|
    Document.trigger(:step)
    event.prevent_default
  end

  Document.on(:mousedown) do |event|
    case event.which
    when 1 then Document.trigger(:step)
    when 3 then toggle_mesage_box
    when 2 then toggle_mesage_box
    end
    event.prevent_default
  end

  Document.on(:contextmenu) do |event|
    event.prevent_default
  end
end
