module Lemonade
  module DSL
    def novel(*args, &story_block)
      Lemonade::Story.novel(*args, &story_block)
    end
  end
end

extend Lemonade::DSL
Module.send(:include, Lemonade::DSL)
