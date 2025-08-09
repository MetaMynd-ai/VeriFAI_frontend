import { Routes } from '@angular/router';
import { MyAgentsComponent } from 'app/modules/admin/app/agents/my-agents/my-agents.component';
import { AgentFormComponent } from './agent-form/agent-form.component';
import { AgentProfilePageComponent } from './agent-profile-page/agent-profile-page.component';
import { MyAgentsListComponent } from './my-agents-list/my-agents-list.component';
import { MyRoomsComponent } from './my-rooms/my-rooms.component';
import { RoomCreationComponent } from './my-rooms/room-creation/room-creation.component';
import { ChatRoomComponent } from './my-rooms/chat-room/chat-room.component';

export default [
    {
        path     : '',
        component: MyAgentsComponent, // MyAgentsComponent is the layout/container
        children: [
            {
                path: '', // Default child route for /my-agents, displays the list
                component: MyAgentsListComponent, // Display MyAgentsListComponent here
                pathMatch: 'full'
            },
            {
                path: 'new',
                component: AgentFormComponent,
            },
            {
                path: 'edit/:id',
                component: AgentFormComponent,
            },
            {
                path: 'profile/:agentAccountId',
                component: AgentProfilePageComponent,
            },
            // Rooms routes
            {
                path: 'rooms',
                component: MyRoomsComponent,
            },
            {
                path: 'rooms/create',
                component: RoomCreationComponent,
            },
            {
                path: 'rooms/chat/:sessionId',
                component: ChatRoomComponent,
            },
            {
                path: 'rooms/transcript/:sessionId',
                component: ChatRoomComponent, // For now, reuse ChatRoomComponent for transcript view
            },
        ]
    },
] as Routes;
