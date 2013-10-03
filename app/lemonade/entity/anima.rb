module Lemonade
  module Entity
    class Anima < Base
      def talk!(text)
        if self.respond_to?(:name)
          add_name_element
        else
          remove_name_element
        end
        add_talk_element(text)
      end

      def talk(text)
        Event.new { talk!(text) }.save
      end

      def show!
        show_or_add_image_element
      end

      def show
        Event.new { show! }.save
      end

      def hide!
        hide_or_remove_element
      end

      def hide
        Event.new { hide! }.save
      end

      private

      def show_or_add_image_element
        self.show_or_add_element
        Document.ready? do
          element = ::Element.id(self.id)
          return if element.nil?
          element.css('background-image', "url('images/anima_#{self.id}.png')")
        end
      end

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

      def remove_name_element
        Document.ready? do
          name = Name.find
          name.remove if name
        end
      end
    end
  end
end
