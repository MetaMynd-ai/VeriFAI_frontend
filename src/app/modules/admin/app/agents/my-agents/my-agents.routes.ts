import { Routes } from '@angular/router';
import { MyAgentsComponent } from 'app/modules/admin/app/agents/my-agents/my-agents.component';
import { AgentFormComponent } from './agent-form/agent-form.component'; // Corrected import path
import { AgentProfilePageComponent } from './agent-profile-page/agent-profile-page.component';
import { MyAgentsListComponent } from './my-agents-list/my-agents-list.component'; // Import MyAgentsListComponent

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
        ]
    },
] as Routes;
