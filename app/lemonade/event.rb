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

      def exec
        event = @events.shift
        event.exec if event
      end
    end
  end
end
