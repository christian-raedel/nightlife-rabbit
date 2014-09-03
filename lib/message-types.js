module.exports = {
    1  : ['HELLO'        , '[{{type}} , {{realm|uri}}                     , {{details|dict}}]']                  ,
    2  : ['WELCOME'      , '[{{type}} , {{session|id}}                    , {{details|dict}}]']                  ,
    3  : ['ABORT'        , '[{{type}} , {{details|dict}}                  , {{reason|uri}}]']                    ,
    4  : ['CHALLENGE'    , '[{{type}} , ]']                               ,
    5  : ['AUTHENTICATE' , '[{{type}} , ]']                               ,
    6  : ['GOODBYE'      , '[{{type}} , {{details|dict}}                  , {{reason|uri}}]']                    ,
    7  : ['HEARTBEAT'    , '[{{type}} , ]']                               ,
    8  : ['ERROR'        , '[{{type}} , {{request.type|type}}             , {{request.id|id}}                    , {{details|dict}}             , {{error|uri}}                     , {{args|list|optional}}              , {{kwargs|dict|optional}}]'] ,

    16 : ['PUBLISH'      , '[{{type}} , {{request|id}}                    , {{options|dict}}                     , {{topic|uri}}                , {{args|list|optional}}            , {{kwargs|dict|optional}}]']         ,
    17 : ['PUBLISHED'    , '[{{type}} , {{publish.request.id|id}}         , {{publication.id|id}}]']             ,

    32 : ['SUBSCRIBE'    , '[{{type}} , {{request|id}}                    , {{options|dict}}                     , {{topic|uri}}]']             ,
    33 : ['SUBSCRIBED'   , '[{{type}} , {{subscribe.request.id|id}}       , {{subscription.id|id}}]']            ,
    34 : ['UNSUBSCRIBE'  , '[{{type}} , {{request|id}}                    , {{subscribed.subscription.id|id}}]'] ,
    35 : ['UNSUBSCRIBED' , '[{{type}} , {{unsubscribe.request.id|id}}]']  ,
    36 : ['EVENT'        , '[{{type}} , {{subscribed.subscription.id|id}} , {{published.publication.id|id}}      , {{details|dict}}             , {{publish.args|list|optional}}    , {{publish.kwargs|dict|optional}}]'] ,

    48 : ['CALL'         , '[{{type}} , {{request|id}}                    , {{options|dict}}                     , {{procedure|uri}}            , {{args|list|optional}}            , {{kwargs|dict|optional}}]']         ,
    49 : ['CANCEL'       , '[{{type}} , ]']                               ,
    50 : ['RESULT'       , '[{{type}} , {{call.request.id|id}}            , {{options|dict}}                     , {{yield.args|list|optional}} , {{yield.kwargs|dict|optional}}]'] ,

    64 : ['REGISTER'     , '[{{type}} , {{request|id}}                    , {{options|dict}}                     , {{procedure|uri}}]']         ,
    65 : ['REGISTERED'   , '[{{type}} , {{register.request.id|id}}        , {{registration.id|id}}]']            ,
    66 : ['UNREGISTER'   , '[{{type}} , {{request|id}}                    , {{registered.registration.id|id}}]'] ,
    67 : ['UNREGISTERED' , '[{{type}} , {{unregister.request.id|id}}]']   ,
    68 : ['INVOCATION'   , '[{{type}} , {{request|id}}                    , {{registered.registration.id|id}}    , {{details|dict}}             , {{call.args|list|optional}}       , {{call.kwargs|dict|optional}}]']    ,
    69 : ['INTERRUPT'    , '[{{type}} , ]']                               ,
    70 : ['YIELD'        , '[{{type}} , {{invocation.request.id|id}}      , {{options|dict}}                     , {{args|list|optional}}       , {{kwargs|dict|optional}}]']
};
