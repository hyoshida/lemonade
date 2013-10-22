module Lemonade
  class Event
    def initialize(*args, &block)
      @args = args
      @block = block
    end

    def exec
      @block.call(*@args)
    end

    def save
      !!self.class.push(self)
    end

    class << self
      def push(event)
        @events ||= []
        @events.push(event)
      end

      def unshift(event)
        @events ||= []
        @events.unshift(event)
      end

      def exec
        event = @events.shift
        return unless event
        nested_events = @events
        @events = []
        event.exec
        @events.concat(nested_events).compact!
      end
    end
  end
end
