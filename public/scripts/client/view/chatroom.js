define(['scripts/client/bootstrap.js'], function(){


  ChatRoomsView = Backbone.View.extend({
    initialize: function(chatrooms){
      this.chatrooms = chatrooms;

      this.addAll();
    },
    addAll: function() {
      _.each(this.chatrooms, function(chatroom){console.log(chatroom); this.addOne(chatroom)}, this);
    },
    addOne: function(chatroom){
      //TODO: should be passing target to attach to
      new ChatRoomView(chatroom);
    }
  });

  ChatRoomView = Backbone.View.extend({
    events: {
      "click .submit": "send"
    },
    template: T['chatroom'],
    initialize: function(chatroom){
      this.model = chatroom;
      this.messages = this.model.get('messages');

      $(this.el).html(this.template.r({}));
      $('#side').append(this.el);

      this.input = $(this.el).find("form input[type=text]");
      this.output = $(this.el).find(".messages");

      this.messages.bind('reset', this.addAll, this);
      this.messages.bind('add', this.addOne, this);

      this.addAll();
    },
    addOne: function(m) {
      var view = new MessageView({model: m});
      this.output.append(view.render().el);
    },
    addAll: function() {
      this.output.html('');
      this.messages.each(this.addOne, this);
    },
    send: function() {
      var content = this.input.val();
      
      m = this.messages.create({content:content,username:user.get('name')});

      this.input.val('');
    }
  });

  MessageView = Backbone.View.extend({
    template: T['message'],
    initialize: function() {
      this.bind('change', function(){this.render()}, this);
    },
    render: function(){
      $(this.el).html(this.template.r(this.model.toData()));
      
      return this;
    }
  });

});