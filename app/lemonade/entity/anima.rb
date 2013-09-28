module Lemonade
  module Entity
    class Anima < Base
      def add_talk(text)
        add_name_element
        add_talk_element(text)
      end

      def talk(text)
        Event.new { add_talk text }.save
      end

      private

      def add_talk_element(text)
        Document.ready? do
          message_box = MessageBox.find_or_initialize
          talk = Talk.find_or_initialize(parent: message_box)
          talk.text = text
          animation_for(talk)
        end
      end

      def add_name_element
        Document.ready? do
          message_box = MessageBox.find_or_initialize
          name = Name.find_or_initialize(parent: message_box)
          name.text = self.name
        end
      end
    end
  end
end
